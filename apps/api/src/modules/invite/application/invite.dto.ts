import type { Invite } from "../domain/invite.js";

/**
 * What the transport sends (ADR 0047).
 *
 * The entity is not returned directly: `token` is a value object and `resource`
 * is a nested value, neither of which the client needs in that shape. Keeping
 * the projection here means the wire contract changes deliberately rather than
 * because a field was added to the model.
 */

/** A freshly issued link — the token and how long it lasts, nothing else. */
export interface IssuedInviteDto {
  token: string;
  expiresAt: Date;
}

export function toIssuedInviteDto(invite: Invite): IssuedInviteDto {
  return { token: invite.token, expiresAt: invite.expiresAt };
}

/** An invite as shown to the owner managing a resource's links. */
export interface InviteSummaryDto {
  id: string;
  token: string;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export function toInviteSummaryDto(invite: Invite): InviteSummaryDto {
  return {
    id: invite.id,
    token: invite.token,
    expiresAt: invite.expiresAt,
    revokedAt: invite.revokedAt,
    createdAt: invite.createdAt,
  };
}
