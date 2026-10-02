import type { Invite as InviteRow } from "../../../shared/db/schema/invites.js";
import type { Invite } from "../domain/invite.js";
import { inviteTokenFrom } from "../domain/invite-token.js";

/**
 * The one place the table's shape and the domain's meet (ADR 0047).
 *
 * `resource_type` + `resource_id` become a single `ResourceRef`, and the token
 * string is lifted into its value object — which throws if the row is corrupt,
 * because a row that cannot form a valid entity is not something to carry on
 * with silently.
 */
export function toDomain(row: InviteRow): Invite {
  return {
    id: row.id,
    token: inviteTokenFrom(row.token),
    resource: {
      resourceType: row.resourceType,
      resourceId: row.resourceId,
    },
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}
