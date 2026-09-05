import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createInMemorySessionRepository } from "../sessions/session.repository.in-memory.js";
import { createSessionService } from "../sessions/session.service.js";
import type { SessionService } from "../sessions/session.service.types.js";
import { createInMemoryUserRepository } from "../users/user.repository.in-memory.js";
import type { UserRepository } from "../users/user.repository.js";
import { SESSION_COOKIE } from "./auth.controller.constants.js";
import { createAuthService } from "./auth.service.js";
import { createFakeGitHubOAuthClient } from "./github-oauth.client.fake.js";
import { createRequireAuth, getAuthenticatedUser } from "./require-auth.js";

interface Harness {
  app: Express;
  sessionService: SessionService;
  userRepository: UserRepository;
}

/**
 * Wires a real {@link AuthService} (in-memory repos) behind `requireAuth`, then
 * mounts a trivial protected route that echoes the authenticated user's email —
 * proving both the guard and the {@link getAuthenticatedUser} accessor.
 */
function setup(options: { redirectTo?: string } = {}): Harness {
  const sessionService = createSessionService({
    sessionRepository: createInMemorySessionRepository(),
  });
  const userRepository = createInMemoryUserRepository();
  const authService = createAuthService({
    githubClient: createFakeGitHubOAuthClient({
      authorizationUrl: "https://github.test/authorize",
      tokensByCode: {},
      usersByToken: {},
    }),
    userRepository,
    sessionService,
  });

  const requireAuth = createRequireAuth({
    authService,
    redirectTo: options.redirectTo,
  });

  const app = express();
  app.use(cookieParser());
  app.get("/protected", requireAuth, (_req, res) => {
    res.status(200).json({ email: getAuthenticatedUser(res).email });
  });

  return { app, sessionService, userRepository };
}

/** Seeds a user + a live session, returning the session id for the cookie. */
async function signIn(harness: Harness): Promise<string> {
  const user = await harness.userRepository.upsertByGithubId({
    githubId: "gh-1",
    name: "Ada",
    email: "ada@x.com",
    imageUrl: null,
  });
  const session = await harness.sessionService.createForUser(user.id);
  return session.id;
}

describe("requireAuth", () => {
  it("calls through and exposes the authenticated user on a valid session", async () => {
    const harness = setup();
    const sessionId = await signIn(harness);

    const res = await request(harness.app)
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ email: "ada@x.com" });
  });

  it("responds 401 when the session cookie is absent", async () => {
    const harness = setup();

    const res = await request(harness.app).get("/protected");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: "unauthenticated" });
  });

  it("responds 401 when the session is invalid or expired", async () => {
    const harness = setup();

    const res = await request(harness.app)
      .get("/protected")
      .set("Cookie", `${SESSION_COOKIE}=not-a-real-session`);

    expect(res.status).toBe(401);
  });

  it("redirects unauthenticated browsers when `redirectTo` is set", async () => {
    const harness = setup({ redirectTo: "/auth/github" });

    const res = await request(harness.app).get("/protected");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/github");
  });
});

describe("getAuthenticatedUser", () => {
  it("throws when called without the requireAuth middleware", () => {
    expect(() => getAuthenticatedUser({ locals: {} })).toThrow();
  });
});
