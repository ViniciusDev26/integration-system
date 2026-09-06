import type { RequestHandler } from "express";
import type { User } from "../../shared/db/schema/users.js";
import { readCookie } from "../../shared/http/cookies.js";
import { SESSION_COOKIE } from "./auth.controller.constants.js";
import type { AuthService } from "./auth.service.types.js";

/**
 * Key under which the authenticated user is stashed on `res.locals`. Reading it
 * back goes through {@link getAuthenticatedUser} so handlers never touch the
 * untyped locals bag directly.
 */
const CURRENT_USER_LOCAL = "authUser";

export interface RequireAuthOptions {
  /** Only the resolver is needed; narrowed so tests can pass a minimal fake. */
  authService: Pick<AuthService, "getCurrentUser">;
  /**
   * Where to send unauthenticated callers. When set (page routes), a missing or
   * invalid session yields a 302 redirect; otherwise (API routes) a 401 JSON.
   */
  redirectTo?: string;
}

/**
 * Route guard for authenticated pages/endpoints (ADR 0020). Resolves the current
 * user from the `session` cookie via {@link AuthService.getCurrentUser}; on
 * success it stashes the user for handlers (see {@link getAuthenticatedUser}) and
 * calls `next()`. Otherwise it short-circuits with a redirect or 401 and the
 * handler never runs.
 *
 * Express 5 forwards a rejected promise here to the error middleware, so a
 * transient store failure surfaces as a 500 rather than a silent bypass.
 */
export function createRequireAuth(options: RequireAuthOptions): RequestHandler {
  const { authService, redirectTo } = options;

  return async (req, res, next) => {
    const sessionId = readCookie(req, SESSION_COOKIE);
    const user =
      sessionId.length > 0 ? await authService.getCurrentUser(sessionId) : null;

    if (user === null) {
      if (redirectTo !== undefined) {
        res.redirect(redirectTo);
      } else {
        res.status(401).json({ error: "unauthenticated" });
      }
      return;
    }

    res.locals[CURRENT_USER_LOCAL] = user;
    next();
  };
}

/**
 * Reads the user established by {@link createRequireAuth}. Call only from
 * handlers mounted behind that middleware: a missing user here is a wiring bug,
 * not a runtime condition, so it throws rather than returning `null`.
 */
export function getAuthenticatedUser(res: {
  locals: Record<string, unknown>;
}): User {
  const user = res.locals[CURRENT_USER_LOCAL];
  if (user === undefined) {
    throw new Error(
      "getAuthenticatedUser: no user on res.locals — is requireAuth mounted before this handler?",
    );
  }
  return user as User;
}
