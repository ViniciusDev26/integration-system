import type { CookieOptions } from "express";
import { readCookie } from "../../shared/http/cookies.js";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "../../trpc/trpc.js";
import type { SessionService } from "../sessions/session.service.types.js";
import { SESSION_COOKIE } from "./auth.controller.constants.js";

export interface AuthRouterOptions {
  sessionService: SessionService;
  /** Match the session cookie attributes so `clearCookie` actually clears it. */
  secureCookies: boolean;
}

/**
 * Auth tRPC procedures (ADR 0037): the current user and logout. The GitHub OAuth
 * redirect flow stays plain Express (`/auth/*`) — it can't be tRPC.
 */
export function createAuthRouter({
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
