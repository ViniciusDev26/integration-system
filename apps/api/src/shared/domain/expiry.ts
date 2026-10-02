/**
 * Expiry, shared by everything here that issues something time-limited
 * (ADR 0046 domain layer): invites, sessions.
 *
 * It lives in `shared/` because the **boundary semantics must agree** — an
 * invite and a session both treat the expiry instant itself as expired, and
 * before this they did so by coincidence of two separate implementations.
 */

/** When something issued at `issuedAt` with lifetime `ttlMs` stops working. */
export function expiresAtFrom(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}

/**
 * Whether `expiresAt` has passed at `now`.
 *
 * The instant itself counts as expired: a lifetime of zero is never valid, and
 * the boundary is closed rather than left to each caller to guess.
 */
export function hasExpired(expiresAt: Date, now: Date): boolean {
  return expiresAt.getTime() <= now.getTime();
}
