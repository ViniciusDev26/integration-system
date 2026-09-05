import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { engine } from "express-handlebars";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { SESSION_COOKIE } from "../auth/auth.controller.constants.js";
import { createAuthService } from "../auth/auth.service.js";
import { createFakeGitHubOAuthClient } from "../auth/github-oauth.client.fake.js";
import { createInMemorySessionRepository } from "../sessions/session.repository.in-memory.js";
import { createSessionService } from "../sessions/session.service.js";
import { createInMemoryUserRepository } from "../users/user.repository.in-memory.js";
import { createWebController } from "./web.controller.js";
import { createWebRoutes } from "./web.routes.js";

const githubUser = {
  id: "gh-1",
  login: "ada",
  name: "Ada Lovelace",
  email: "ada@x.com",
  avatarUrl: "http://img/ada",
};

interface Harness {
  app: Express;
  login(): Promise<string>;
}

function setup(): Harness {
  const sessionService = createSessionService({
    sessionRepository: createInMemorySessionRepository(),
  });
  const userRepository = createInMemoryUserRepository();
  const authService = createAuthService({
    githubClient: createFakeGitHubOAuthClient({
      tokensByCode: { "good-code": "access-1" },
      usersByToken: { "access-1": githubUser },
    }),
    userRepository,
    sessionService,
  });
  const controller = createWebController({ authService });

  const app = express();
  // Mirror app.ts: templates live in ../../views relative to this module.
  app.engine("handlebars", engine({ defaultLayout: "main" }));
  app.set("view engine", "handlebars");
  app.set("views", path.join(import.meta.dirname, "..", "..", "views"));
  app.use(cookieParser());
  app.use("/", createWebRoutes(controller));

  // Helper: perform a real login and return the resulting session id.
  async function login(): Promise<string> {
    const session = await authService.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });
    return session.id;
  }

  return { app, login };
}

describe("web controller — GET /", () => {
  it("renders the signed-out home with a GitHub sign-in link", async () => {
    const { app } = setup();

    const res = await request(app).get("/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("Spotifake");
    expect(res.text).toContain('href="/auth/github"');
    expect(res.text).not.toContain("Log out");
  });

  it("renders the signed-in home with the user and a logout form", async () => {
    const { app, login } = setup();
    const sessionId = await login();

    const res = await request(app)
      .get("/")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Ada Lovelace");
    expect(res.text).toContain("ada@x.com");
    expect(res.text).toContain('action="/auth/logout"');
    expect(res.text).toContain('href="/musics/new"');
    expect(res.text).not.toContain('href="/auth/github"');
  });

  it("treats an invalid session cookie as signed out", async () => {
    const { app } = setup();

    const res = await request(app)
      .get("/")
      .set("Cookie", `${SESSION_COOKIE}=bogus`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('href="/auth/github"');
  });
});
