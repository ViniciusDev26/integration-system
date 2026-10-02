import {
  expiresAtFrom as expiryFrom,
  hasExpired,
} from "../../../shared/domain/expiry.js";
import type { InviteToken } from "./invite-token.js";
import type { ResourceRef } from "./resource.js";

/**
 * An invite (ADR 0047 entity).
 *
 * Defined by the domain, **not inferred from the table**: `resource` is one
 * value here and two columns there, and `token` is a value object rather than a
 * string. The repository's mapper is the only place the two shapes meet.
 *
 * Everything below is decidable from this value plus a timestamp — no
 * repository, no port, no injected clock (ADR 0046). The domain **returns
 * outcomes rather than throwing**; turning one into a typed error is the
 * application layer's job.
 */
export interface Invite {
  readonly id: string;
  readonly token: InviteToken;
  readonly resource: ResourceRef;
  /** `users.id` of whoever issued it. */
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  /** Set once revoked; a revoked invite never comes back. */
  readonly revokedAt: Date | null;
}

/** Whether an invite can be redeemed, and if not, why. */
export type Redeemability = "redeemable" | "revoked" | "expired";

/**
 * Revocation outranks expiry: an invite that was both revoked and has since
 * expired reports `revoked`, because that is the deliberate act and the more
 * useful thing to tell someone.
 */
export function redeemabilityOf(invite: Invite, now: Date): Redeemability {
  if (invite.revokedAt !== null) {
    return "revoked";
  }
  if (hasExpired(invite.expiresAt, now)) {
    return "expired";
  }
  return "redeemable";
}

/** Shorthand for the common question. */
export function isRedeemable(invite: Invite, now: Date): boolean {
  return redeemabilityOf(invite, now) === "redeemable";
}

/**
 * When an invite issued at `issuedAt` should stop working. Re-exported from the
 * shared rule so invites and sessions cannot drift apart on the boundary.
 */
export const expiresAtFrom = expiryFrom;

/**
 * The revocation timestamp to record, or `null` when there is nothing to do.
 *
 * Revoking twice must not move the original timestamp — the first act is the
 * one that happened.
 */
export function revocationFor(invite: Invite, now: Date): Date | null {
  return invite.revokedAt === null ? now : null;
}
