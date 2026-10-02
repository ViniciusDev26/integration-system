/**
 * What an invite can address (ADR 0040), owned by the **domain** rather than by
 * the table (ADR 0047).
 *
 * The Drizzle schema imports this for its column type and check constraint, not
 * the other way round: persistence depends on the domain.
 */
export const INVITE_RESOURCE_TYPES = ["PLAYLIST", "ROOM"] as const;
export type InviteResourceType = (typeof INVITE_RESOURCE_TYPES)[number];

/** A resource an invite points at — the pair is what identifies it. */
export interface ResourceRef {
  readonly resourceType: InviteResourceType;
  readonly resourceId: string;
}
