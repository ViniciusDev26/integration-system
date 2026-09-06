/** Short-lived httpOnly cookie holding the OAuth CSRF `state` (ADR 0020). */
export const OAUTH_STATE_COOKIE = "oauth_state";

/** httpOnly cookie holding the opaque server-side session id (ADR 0016). */
export const SESSION_COOKIE = "session";

/**
 * Lifetime of the `state` cookie: it only has to survive the round-trip to
 * GitHub and back, so a few minutes is plenty (ADR 0020).
 */
export const STATE_COOKIE_MAX_AGE_MS = 10 * 60 * 1000;

/** Where the browser lands after a successful login. */
export const POST_LOGIN_REDIRECT_PATH = "/";

/** Where the browser lands after logout. */
export const POST_LOGOUT_REDIRECT_PATH = "/";
