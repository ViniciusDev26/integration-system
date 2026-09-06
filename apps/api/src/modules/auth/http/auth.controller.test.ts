import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createTestContainer } from "../../../container-test.js";
import type { UserRepository } from "../../users/user.repository.js";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from "./auth.controller.constants.js";
import { createAuthController } from "./auth.controller.js";
import { createAuthRoutes } from "./auth.routes.js";

const githubUser = {
  id: "gh-1",
  login: "ada",
  name: "Ada",
  email: "ada@x.com",
  avatarUrl: "http://img/ada",
};

interface Harness {
  app: Express;
  userRepository: UserRepository;
}

function setup(): Harness {
  const { authService, userRepository } = createTestContainer({
    github: {
      authorizationUrl: "https://github.test/login/oauth/authorize",
      tokensByCode: { "good-code": "access-1" },
      usersByToken: { "access-1": githubUser },
    },
    generateState: () => "state-xyz",
  });
  const controller = createAuthController({
    authService,
    secureCookies: false,
  });

  const app = express();
  app.use(cookieParser());
  app.use("/auth", createAuthRoutes(controller));

  return { app, userRepository };
}

/** The `set-cookie` header is an array at runtime; validate at this boundary. */
const setCookieSchema = z.array(z.string());

/** Extracts a single cookie's value from a response's `set-cookie` header. */
function cookieValue(setCookie: string[], name: string): string | undefined {
  const entry = setCookie.find((c) => c.startsWith(`${name}=`));
  return entry?.split(";")[0]?.split("=")[1];
}

describe("auth controller — GET /auth/github/callback", () => {
  it("exchanges the code, sets a session cookie, and redirects on success", async () => {
    const { app, userRepository } = setup();

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "good-code", state: "state-xyz" })
      .set("Cookie", `${OAUTH_STATE_COOKIE}=state-xyz`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");

    const setCookie = setCookieSchema.parse(res.headers["set-cookie"]);
    const sessionId = cookieValue(setCookie, SESSION_COOKIE);
    expect(sessionId).toBeTruthy();
    expect(setCookie.find((c) => c.startsWith(`${SESSION_COOKIE}=`))).toMatch(
      /HttpOnly/i,
    );

    const user = await userRepository.findByGithubId("gh-1");
    expect(user).not.toBeNull();
  });

  it("returns 401 when the state does not match the cookie (CSRF)", async () => {
    const { app } = setup();

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "good-code", state: "attacker" })
      .set("Cookie", `${OAUTH_STATE_COOKIE}=victim`);

    expect(res.status).toBe(401);
  });

  it("returns 401 when the state cookie is missing", async () => {
    const { app } = setup();

    const res = await request(app)
      .get("/auth/github/callback")
      .query({ code: "good-code", state: "state-xyz" });

    expect(res.status).toBe(401);
  });

  it("returns 400 when required query params are missing", async () => {
    const { app } = setup();

    const res = await request(app)
      .get("/auth/github/callback")
      .set("Cookie", `${OAUTH_STATE_COOKIE}=state-xyz`);

    expect(res.status).toBe(400);
  });

  it("accepts GitHub's extra `iss` query param (RFC 9207)", async () => {
    const { app } = setup();

    const res = await request(app)
      .get("/auth/github/callback")
      .query({
        code: "good-code",
        state: "state-xyz",
        iss: "https://github.com",
      })
      .set("Cookie", `${OAUTH_STATE_COOKIE}=state-xyz`);

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});
