/**
 * Invite rules (ADR 0046 domain layer).
 *
 * Everything here is decidable from the data in hand plus a timestamp — no
 * repository, no port, no injected clock. `now` arrives as an argument, which
 * is what lets these be tested by constructing a value and calling a function.
 *
 * The domain **returns outcomes rather than throwing**; turning an outcome into
 * a typed error is the application layer's job.
 */

/** The fields of an invite the rules actually depend on. */
export interface InviteState {
  /** Set once the invite was revoked; a revoked invite never comes back. */
  revokedAt: Date | null;
  expiresAt: Date;
}

/** Whether an invite can be redeemed, and if not, why. */
export type Redeemability = "redeemable" | "revoked" | "expired";

/**
 * Revocation outranks expiry: an invite that was both revoked and has since
 * expired reports `revoked`, because that is the deliberate act and the more
 * useful thing to tell someone.
 */
export function redeemabilityOf(invite: InviteState, now: Date): Redeemability {
  if (invite.revokedAt !== null) {
    return "revoked";
  }
  // The expiry instant itself counts as expired, matching session validation.
  if (invite.expiresAt.getTime() <= now.getTime()) {
    return "expired";
  }
  return "redeemable";
}

/** Shorthand for the common question. */
export function isRedeemable(invite: InviteState, now: Date): boolean {
  return redeemabilityOf(invite, now) === "redeemable";
}

/** When an invite issued at `issuedAt` should stop working. */
export function expiresAtFrom(issuedAt: Date, ttlMs: number): Date {
  return new Date(issuedAt.getTime() + ttlMs);
}

/**
 * The revocation timestamp to record, or `null` when there is nothing to do.
 *
 * Revoking twice must not move the original timestamp — the first act is the
 * one that happened.
 */
export function revocationFor(invite: InviteState, now: Date): Date | null {
  return invite.revokedAt === null ? now : null;
}
