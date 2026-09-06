import type { CookieOptions } from "express";
import { z } from "zod";
import { readCookie } from "../../shared/http/cookies.js";
import {
  OAUTH_STATE_COOKIE,
  POST_LOGIN_REDIRECT_PATH,
  SESSION_COOKIE,
} from "./auth.controller.constants.js";
import type {
  AuthController,
  AuthControllerOptions,
} from "./auth.controller.types.js";

/**
 * Query schema for the OAuth callback (ADR 0012). GitHub returns `code` + the
 * `state` we issued; both required. `z.object` (not a raw shape) strips GitHub's
 * extra `iss` param (RFC 9207) instead of 400-ing.
 */
export const githubCallbackSchema = {
  query: z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }),
};

/**
 * The GitHub OAuth **callback** (ADR 0020) — the one irreducible REST route: a
 * browser redirect from GitHub that sets the session cookie and redirects to the
 * SPA. Login initiation, `me`, and `logout` are tRPC procedures (ADR 0037).
 */
export function createAuthController(
  options: AuthControllerOptions,
): AuthController {
  const { secureCookies } = options;

  const baseCookie: CookieOptions = {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
  };

  return {
    async handleGithubCallback(req, res) {
      const { code, state } = req.query;
      const expectedState = readCookie(req, OAUTH_STATE_COOKIE);

      // HTTP-level CSRF check: a missing/mismatched state cookie means this
      // callback wasn't initiated by us (401). The service re-checks as defense
      // in depth.
      if (expectedState.length === 0 || expectedState !== state) {
        res.clearCookie(OAUTH_STATE_COOKIE, baseCookie);
        res.status(401).json({ error: "invalid_oauth_state" });
        return;
      }

      const session = await options.authService.handleCallback({
        code,
        state,
        expectedState,
      });

      res.clearCookie(OAUTH_STATE_COOKIE, baseCookie);
      res.cookie(SESSION_COOKIE, session.id, {
        ...baseCookie,
        expires: session.expiresAt,
      });
      // Land the browser on the SPA; it will fetch the session via tRPC `auth.me`.
      res.redirect(POST_LOGIN_REDIRECT_PATH);
    },
  };
}
