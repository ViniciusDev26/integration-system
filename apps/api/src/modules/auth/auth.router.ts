import type { CookieOptions } from "express";
import { readCookie } from "../../shared/http/cookies.js";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "../../trpc/trpc.js";
import type { SessionService } from "../sessions/session.service.types.js";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE_MAX_AGE_MS,
} from "./auth.controller.constants.js";
import type { AuthService } from "./auth.service.types.js";

export interface AuthRouterOptions {
  authService: AuthService;
  sessionService: SessionService;
  /** Match the session cookie attributes so `clearCookie` actually clears it. */
  secureCookies: boolean;
}

/**
 * Auth tRPC procedures (ADR 0037): start login, current user, logout. Only the
 * OAuth **callback** stays plain Express (`/auth/github/callback`) — it's a
 * browser redirect from GitHub and can't be tRPC.
 */
export function createAuthRouter({
  authService,
  sessionService,
  secureCookies,
}: AuthRouterOptions) {
  const baseCookie: CookieOptions = {
    httpOnly: true,
    secure: secureCookies,
    sameSite: "lax",
    path: "/",
  };

  return router({
    /** Begin GitHub OAuth: issue the CSRF `state` cookie and return the URL to
     * navigate to. The SPA does `window.location = url`. */
    startLogin: publicProcedure.mutation(({ ctx }) => {
      const { url, state } = authService.getLoginUrl();
      ctx.res.cookie(OAUTH_STATE_COOKIE, state, {
        ...baseCookie,
        maxAge: STATE_COOKIE_MAX_AGE_MS,
      });
      return { url };
    }),

    me: protectedProcedure.query(({ ctx }) => {
      const user = ctx.user;
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        imageUrl: user.imageUrl,
      };
    }),

    logout: publicProcedure.mutation(async ({ ctx }) => {
      const sessionId = readCookie(ctx.req, SESSION_COOKIE);
      if (sessionId.length > 0) {
        await sessionService.revoke(sessionId);
      }
      ctx.res.clearCookie(SESSION_COOKIE, baseCookie);
      return { ok: true };
    }),
  });
}
