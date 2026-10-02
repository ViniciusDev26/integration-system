import { randomBytes } from "node:crypto";
import type { Invite } from "../../../shared/db/schema/invites.js";
import type { ResourceMembership } from "../resource-membership.js";
import {
  DEFAULT_INVITE_TTL_MS,
  INVITE_TOKEN_BYTES,
} from "./invite.service.constants.js";
import {
  InviteExpiredError,
  InviteForbiddenError,
  InviteNotFoundError,
  InviteResourceNotFoundError,
  InviteRevokedError,
} from "./invite.service.errors.js";
import type {
  InviteService,
  InviteServiceOptions,
} from "./invite.service.types.js";

/**
 * Invite links (ADR 0040). Every authorization question and every membership
 * write is delegated to the {@link ResourceMembership} adapter registered for
 * the invite's resource type, which is what keeps this service from knowing
 * whether it is inviting to a playlist or a room.
 */
export function createInviteService(
  options: InviteServiceOptions,
): InviteService {
  const { inviteRepository, resourceMembership } = options;
  const ttlMs = options.ttlMs ?? DEFAULT_INVITE_TTL_MS;
  const now = options.now ?? (() => new Date());
  const generateToken =
    options.generateToken ??
    (() => randomBytes(INVITE_TOKEN_BYTES).toString("base64url"));

  /** The adapter for an invite's resource type. */
  function membershipFor(invite: {
    resourceType: keyof typeof resourceMembership;
  }): ResourceMembership {
    return resourceMembership[invite.resourceType];
  }

  /** Throws unless the resource is still there and the user may invite to it. */
  async function assertMayManage(
    membership: ResourceMembership,
    resourceId: string,
    userId: string,
  ): Promise<void> {
    if (!(await membership.exists(resourceId))) {
      throw new InviteResourceNotFoundError(
        `resource not found: ${resourceId}`,
      );
    }
    if (!(await membership.canInvite(resourceId, userId))) {
      throw new InviteForbiddenError(
        `user ${userId} may not invite to ${resourceId}`,
      );
    }
  }

  /** Loads an invite by id, or throws. */
  async function requireInvite(inviteId: string): Promise<Invite> {
    const invite = await inviteRepository.findById(inviteId);
    if (invite === null) {
      throw new InviteNotFoundError(`invite not found: ${inviteId}`);
    }
    return invite;
  }

  return {
    async createForResource({ resourceType, resourceId, inviterId }) {
      const membership = resourceMembership[resourceType];
      await assertMayManage(membership, resourceId, inviterId);

      return inviteRepository.create({
        token: generateToken(),
        resourceType,
        resourceId,
        createdBy: inviterId,
        expiresAt: new Date(now().getTime() + ttlMs),
      });
    },

    async redeem({ token, userId }) {
      const invite = await inviteRepository.findByToken(token);
      if (invite === null) {
        throw new InviteNotFoundError("no invite bears this token");
      }
      if (invite.revokedAt !== null) {
        throw new InviteRevokedError(`invite revoked: ${invite.id}`);
      }
      // The expiry instant itself counts as expired, matching session validation.
      if (invite.expiresAt.getTime() <= now().getTime()) {
        throw new InviteExpiredError(`invite expired: ${invite.id}`);
      }

      const membership = membershipFor(invite);
      if (!(await membership.exists(invite.resourceId))) {
        throw new InviteResourceNotFoundError(
          `resource not found: ${invite.resourceId}`,
        );
      }

      // Idempotent by contract, so redeeming an already-joined link is fine.
      await membership.grant(invite.resourceId, userId);

      return {
        resourceType: invite.resourceType,
        resourceId: invite.resourceId,
      };
    },

    async revoke({ inviteId, requesterId }) {
      const invite = await requireInvite(inviteId);
      await assertMayManage(
        membershipFor(invite),
        invite.resourceId,
        requesterId,
      );

      await inviteRepository.revoke(invite.id, now());
    },

    async listForResource({ resourceType, resourceId, requesterId }) {
      await assertMayManage(
        resourceMembership[resourceType],
        resourceId,
        requesterId,
      );

      return inviteRepository.listForResource({ resourceType, resourceId });
    },
  };
}
