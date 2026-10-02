import { TRPCError } from "@trpc/server";
import type { CookieOptions } from "express";
import { z } from "zod";
import { readCookie } from "../../../shared/http/cookies.js";
import {
  protectedProcedure,
  publicProcedure,
  router,
} from "../../../trpc/trpc.js";
import type { SessionService } from "../../sessions/service/session.service.types.js";
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from "../service/auth.service.constants.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "../service/auth.service.errors.js";
import type { AuthService } from "../service/auth.service.types.js";
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE_MAX_AGE_MS,
} from "./auth.controller.constants.js";

/** Maps an {@link AuthService} credential error to a tRPC error, else rethrows. */
function rethrowAsTRPC(err: unknown): never {
  if (err instanceof InvalidCredentialsError) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "invalid_credentials",
    });
  }
  if (err instanceof EmailAlreadyRegisteredError) {
    throw new TRPCError({ code: "CONFLICT", message: "email_in_use" });
  }
  throw err;
}

/**
 * Credential rules (ADR 0043): a real address, and a length-bounded password
 * with **no composition rules**, per NIST SP 800-63B.
 */
const credentialsSchema = z.object({
  // Normalize *before* validating: `z.email().trim()` would check the format
  // first and reject a padded address instead of trimming it.
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

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

    /** Create a password account and sign in (ADR 0043). */
    register: publicProcedure
      .input(
        credentialsSchema.extend({
          name: z.string().trim().min(1).max(100).nullable().default(null),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await authService.register(input);
          ctx.res.cookie(SESSION_COOKIE, session.id, {
            ...baseCookie,
            expires: session.expiresAt,
          });
          return { ok: true };
        } catch (err) {
          rethrowAsTRPC(err);
        }
      }),

    /** Sign in with email and password (ADR 0043). */
    login: publicProcedure
      .input(credentialsSchema)
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await authService.loginWithPassword(input);
          ctx.res.cookie(SESSION_COOKIE, session.id, {
            ...baseCookie,
            expires: session.expiresAt,
          });
          return { ok: true };
        } catch (err) {
          rethrowAsTRPC(err);
        }
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
