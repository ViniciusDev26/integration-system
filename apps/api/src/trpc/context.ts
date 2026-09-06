import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { CookieOptions } from "express";
import { SESSION_COOKIE } from "../modules/auth/http/auth.controller.constants.js";
import type { AuthService } from "../modules/auth/service/auth.service.types.js";
import type { User } from "../shared/db/schema/users.js";
import { readCookie } from "../shared/http/cookies.js";

/**
 * Per-request tRPC context (ADR 0037): the current user resolved from the
 * httpOnly session cookie, plus the narrow slices of req/res the procedures use
 * (reading cookies, clearing the session on logout). Narrowed to what's used so
 * it stays trivially constructible in tests; a full Express req/res is assignable.
 */
export interface Context {
  req: { cookies: unknown };
  res: {
    cookie: (name: string, value: string, options?: CookieOptions) => void;
    clearCookie: (name: string, options?: CookieOptions) => void;
  };
  user: User | null;
}

/**
 * Builds the `createContext` function for the Express adapter, resolving the
 * current user via {@link AuthService.getCurrentUser} from the session cookie.
 */
export function createContextFactory(
  authService: Pick<AuthService, "getCurrentUser">,
): (opts: CreateExpressContextOptions) => Promise<Context> {
  return async ({ req, res }) => {
    const sessionId = readCookie(req, SESSION_COOKIE);
    const user =
      sessionId.length > 0 ? await authService.getCurrentUser(sessionId) : null;
    return { req, res, user };
  };
}
