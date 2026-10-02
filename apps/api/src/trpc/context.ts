import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { CookieOptions } from "express";
import { SESSION_COOKIE } from "../modules/auth/http/auth.controller.constants.js";
import type { AuthService } from "../modules/auth/service/auth.service.types.js";
import type { User } from "../shared/db/schema/users.js";
import { parseCookieHeader, readCookie } from "../shared/http/cookies.js";

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

/**
 * The slice of a WebSocket upgrade request this needs. A real
 * `CreateWSSContextFnOptions` from `@trpc/server/adapters/ws` is assignable to
 * it; narrowing keeps the factory trivially constructible in tests, like
 * {@link Context} itself.
 */
export interface WSUpgradeOptions {
  req: { headers: { cookie?: string | undefined } };
}

/**
 * Builds `createContext` for the **WebSocket** adapter (ADR 0039).
 *
 * The upgrade request never passes through Express, so `cookie-parser` has not
 * run: the raw `Cookie` header is parsed here, and the session is then resolved
 * through the very same {@link AuthService.getCurrentUser} the HTTP transport
 * uses. That is what makes `protectedProcedure` behave identically on a
 * subscription and on a query.
 */
export function createWSContextFactory(
  authService: Pick<AuthService, "getCurrentUser">,
): (opts: WSUpgradeOptions) => Promise<Context> {
  return async ({ req }) => {
    const cookies = parseCookieHeader(req.headers.cookie);
    const sessionId = readCookie({ cookies }, SESSION_COOKIE);
    const user =
      sessionId.length > 0 ? await authService.getCurrentUser(sessionId) : null;

    return { req: { cookies }, res: WS_COOKIE_JAR, user };
  };
}

/**
 * A WebSocket connection has no response to carry `Set-Cookie`. Only the auth
 * mutations touch cookies and `splitLink` keeps those on HTTP, so reaching here
 * means a procedure was routed to the wrong transport — fail loudly rather than
 * drop the cookie silently.
 */
const WS_COOKIE_JAR: Context["res"] = {
  cookie: (name) => {
    throw new Error(
      `Cannot set cookie "${name}" over a WebSocket: no response to carry it.`,
    );
  },
  clearCookie: (name) => {
    throw new Error(
      `Cannot clear cookie "${name}" over a WebSocket: no response to carry it.`,
    );
  },
};
