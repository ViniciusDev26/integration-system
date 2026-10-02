import type { Invite } from "../domain/invite.js";
import type { InviteResourceType } from "../domain/resource.js";
import type { InviteRepository } from "../repository/invite.repository.js";
import type { ResourceMembershipRegistry } from "../resource-membership.js";

export interface CreateInviteForResourceInput {
  resourceType: InviteResourceType;
  resourceId: string;
  /** `users.id` of the inviter; must be allowed to invite. */
  inviterId: string;
}

export interface RedeemInviteInput {
  token: string;
  /** `users.id` of whoever opened the link. */
  userId: string;
}

export interface RevokeInviteInput {
  inviteId: string;
  /** `users.id` of the requester; must be allowed to manage the resource. */
  requesterId: string;
}

export interface ListInvitesInput {
  resourceType: InviteResourceType;
  resourceId: string;
  requesterId: string;
}

/** Where a redeemed invite led, so the caller can navigate there. */
export interface RedeemedInvite {
  resourceType: InviteResourceType;
  resourceId: string;
}

export interface InviteServiceOptions {
  inviteRepository: InviteRepository;
  /** One membership adapter per resource type (ADR 0040). */
  resourceMembership: ResourceMembershipRegistry;
  /** Invite lifetime; defaults to `DEFAULT_INVITE_TTL_MS`. */
  ttlMs?: number;
  /** Injectable clock, so expiry is testable without waiting. */
  now?: () => Date;
  /** Injectable token generator, so tests are deterministic. */
  generateToken?: () => string;
}

/**
 * Invite links, agnostic of what is being invited to (ADR 0040). Authorization
 * and membership are delegated to the {@link ResourceMembershipRegistry}, so
 * this service never learns what a playlist or a room is.
 */
export interface InviteService {
  /** Issues a link for the resource. Only someone allowed to invite may. */
  createForResource(input: CreateInviteForResourceInput): Promise<Invite>;
  /** Redeems a token, granting membership. Idempotent for an existing member. */
  redeem(input: RedeemInviteInput): Promise<RedeemedInvite>;
  /** Revokes a link so it can no longer be redeemed. */
  revoke(input: RevokeInviteInput): Promise<void>;
  /** Every invite issued for the resource, newest first. */
  listForResource(input: ListInvitesInput): Promise<Invite[]>;
}
