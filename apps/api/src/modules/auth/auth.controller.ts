import type { CookieOptions } from "express";
import { z } from "zod";
import { readCookie } from "../../shared/http/cookies.js";
import {
  OAUTH_STATE_COOKIE,
  POST_LOGIN_REDIRECT_PATH,
  POST_LOGOUT_REDIRECT_PATH,
  SESSION_COOKIE,
  STATE_COOKIE_MAX_AGE_MS,
} from "./auth.controller.constants.js";
import type {
  AuthController,
  AuthControllerOptions,
} from "./auth.controller.types.js";

/**
 * Query schema for the OAuth callback (ADR 0012). GitHub returns `code` + the
 * `state` we issued; both are required. Shared with the route so the middleware
 * validates and the handler reads typed values without re-parsing.
 *
 * A plain `z.object` (not a raw shape) is used deliberately: express-zod-safe
 * wraps a raw shape in `z.strictObject` (rejects unknown keys), but GitHub also
 * returns an `iss` param (RFC 9207 issuer identification). `z.object` strips
 * unknown keys instead of 400-ing.
 */
export const githubCallbackSchema = {
  query: z.object({
    code: z.string().min(1),
    state: z.string().min(1),
  }),
};

export function createAuthController(
  options: AuthControllerOptions,
): AuthController {
  const { authService, sessionService, secureCookies } = options;

  const baseCookie: CookieOptions = {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
  };

  return {
    startGithubLogin(_req, res) {
      const { url, state } = authService.getLoginUrl();
      res.cookie(OAUTH_STATE_COOKIE, state, {
        ...baseCookie,
        maxAge: STATE_COOKIE_MAX_AGE_MS,
      });
      res.redirect(url);
    },

    async handleGithubCallback(req, res) {
      const { code, state } = req.query;
      const expectedState = readCookie(req, OAUTH_STATE_COOKIE);

      // HTTP-level CSRF check: a missing or mismatched state cookie means this
      // callback wasn't initiated by us. The service re-checks as defense in
      // depth, but map it here so the client gets a 401 rather than a 500.
      if (expectedState.length === 0 || expectedState !== state) {
        res.clearCookie(OAUTH_STATE_COOKIE, baseCookie);
        res.status(401).json({ error: "invalid_oauth_state" });
        return;
      }

      const session = await authService.handleCallback({
        code,
        state,
        expectedState,
      });

      res.clearCookie(OAUTH_STATE_COOKIE, baseCookie);
      res.cookie(SESSION_COOKIE, session.id, {
        ...baseCookie,
        expires: session.expiresAt,
      });
      res.redirect(POST_LOGIN_REDIRECT_PATH);
    },

    async logout(req, res) {
      const sessionId = readCookie(req, SESSION_COOKIE);
      if (sessionId.length > 0) {
        await sessionService.revoke(sessionId);
      }
      res.clearCookie(SESSION_COOKIE, baseCookie);
      // 303 so the browser follows a POST-logout with a GET of the home page.
      res.redirect(303, POST_LOGOUT_REDIRECT_PATH);
    },
  };
}
