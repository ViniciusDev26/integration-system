import type { InviteResourceType } from "../../shared/db/schema/invites.js";

/**
 * What the invite module needs to know about an invitable resource — and
 * nothing more (ADR 0040). This is the seam that keeps the module agnostic: it
 * never learns what a playlist or a room is.
 *
 * One adapter per {@link InviteResourceType}, registered in the composition root
 * (ADR 0027). Adding rooms means writing a second adapter and allowing a second
 * resource type; no code in this module changes.
 */
export interface ResourceMembership {
  /**
   * Whether the resource is still there. Checked on redeem, because a
   * polymorphic `resource_id` has no foreign key to delete alongside it.
   */
  exists(resourceId: string): Promise<boolean>;
  /** Whether this user is allowed to invite others — today, only an owner. */
  canInvite(resourceId: string, userId: string): Promise<boolean>;
  /** Adds the user as a member. Must be idempotent: redeeming twice is normal. */
  grant(resourceId: string, userId: string): Promise<void>;
}

/**
 * The adapter for each resource type. Keyed by {@link InviteResourceType}, so a
 * new type cannot be added without supplying its membership behaviour.
 */
export type ResourceMembershipRegistry = Record<
  InviteResourceType,
  ResourceMembership
>;
