import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryInviteRepository } from "../repository/invite.repository.in-memory.js";
import type { InviteRepository } from "../repository/invite.repository.js";
import type { ResourceMembership } from "../resource-membership.js";
import { DEFAULT_INVITE_TTL_MS } from "./invite.service.constants.js";
import {
  InviteExpiredError,
  InviteForbiddenError,
  InviteNotFoundError,
  InviteResourceNotFoundError,
  InviteRevokedError,
} from "./invite.service.errors.js";
import { createInviteService } from "./invite.service.js";
import type { InviteService } from "./invite.service.types.js";

const TOKEN_1 = "a".repeat(43);
const TOKEN_2 = "b".repeat(43);
const TOKEN_3 = "c".repeat(43);
const PLAYLIST_ID = "playlist-1";
const OWNER_ID = "user-owner";
const GUEST_ID = "user-guest";

/** A membership fake standing in for whatever the resource turns out to be. */
function createFakeMembership(): ResourceMembership & {
  granted: Array<{ resourceId: string; userId: string }>;
  owners: Set<string>;
  existing: Set<string>;
} {
  const granted: Array<{ resourceId: string; userId: string }> = [];
  const owners = new Set<string>([OWNER_ID]);
  const existing = new Set<string>([PLAYLIST_ID]);

  return {
    granted,
    owners,
    existing,
    async exists(resourceId) {
      return existing.has(resourceId);
    },
    async canInvite(_resourceId, userId) {
      return owners.has(userId);
    },
    async grant(resourceId, userId) {
      granted.push({ resourceId, userId });
    },
  };
}

describe("InviteService", () => {
  let repository: InviteRepository;
  let membership: ReturnType<typeof createFakeMembership>;
  let roomMembership: ReturnType<typeof createFakeMembership>;
  let now: Date;
  let tokens: string[];
  let service: InviteService;

  beforeEach(() => {
    repository = createInMemoryInviteRepository();
    membership = createFakeMembership();
    roomMembership = createFakeMembership();
    now = new Date("2026-10-02T12:00:00.000Z");
    // Long enough to be a real token: the value object validates them now,
    // which is the invariant doing its job (ADR 0047).
    tokens = [TOKEN_1, TOKEN_2, TOKEN_3];
    service = createInviteService({
      inviteRepository: repository,
      resourceMembership: { PLAYLIST: membership, ROOM: roomMembership },
      now: () => now,
      generateToken: () => tokens.shift() ?? `${"z".repeat(43)}`,
    });
  });

  function createInvite(inviterId = OWNER_ID) {
    return service.createForResource({
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      inviterId,
    });
  }

  describe("createForResource", () => {
    it("issues a token that expires after the default TTL", async () => {
      const invite = await createInvite();

      expect(invite.token).toBe(TOKEN_1);
      expect(invite.resource).toEqual({
        resourceType: "PLAYLIST",
        resourceId: PLAYLIST_ID,
      });
      expect(invite.createdBy).toBe(OWNER_ID);
      expect(invite.expiresAt.getTime()).toBe(
        now.getTime() + DEFAULT_INVITE_TTL_MS,
      );
    });

    it("honours an overridden TTL", async () => {
      const shortLived = createInviteService({
        inviteRepository: repository,
        resourceMembership: { PLAYLIST: membership, ROOM: roomMembership },
        ttlMs: 60_000,
        now: () => now,
        generateToken: () => TOKEN_1,
      });

      const invite = await shortLived.createForResource({
        resourceType: "PLAYLIST",
        resourceId: PLAYLIST_ID,
        inviterId: OWNER_ID,
      });

      expect(invite.expiresAt.getTime()).toBe(now.getTime() + 60_000);
    });

    it("refuses someone who may not invite", async () => {
      await expect(createInvite(GUEST_ID)).rejects.toBeInstanceOf(
        InviteForbiddenError,
      );
    });

    it("refuses a resource that does not exist", async () => {
      membership.existing.delete(PLAYLIST_ID);

      await expect(createInvite()).rejects.toBeInstanceOf(
        InviteResourceNotFoundError,
      );
    });
  });

  describe("redeem", () => {
    it("grants membership and reports where the link led", async () => {
      const invite = await createInvite();

      const redeemed = await service.redeem({
        token: invite.token,
        userId: GUEST_ID,
      });

      expect(redeemed).toEqual({
        resourceType: "PLAYLIST",
        resourceId: PLAYLIST_ID,
      });
      expect(membership.granted).toEqual([
        { resourceId: PLAYLIST_ID, userId: GUEST_ID },
      ]);
    });

    it("is reusable — a second person redeems the same link", async () => {
      const invite = await createInvite();

      await service.redeem({ token: invite.token, userId: GUEST_ID });
      await service.redeem({ token: invite.token, userId: "user-third" });

      expect(membership.granted).toHaveLength(2);
    });

    it("rejects an unknown token", async () => {
      await expect(
        service.redeem({ token: "nope", userId: GUEST_ID }),
      ).rejects.toBeInstanceOf(InviteNotFoundError);
    });

    it("rejects an expired invite", async () => {
      const invite = await createInvite();
      now = new Date(now.getTime() + DEFAULT_INVITE_TTL_MS + 1);

      await expect(
        service.redeem({ token: invite.token, userId: GUEST_ID }),
      ).rejects.toBeInstanceOf(InviteExpiredError);
      expect(membership.granted).toEqual([]);
    });

    it("treats the exact expiry instant as expired", async () => {
      const invite = await createInvite();
      now = new Date(invite.expiresAt.getTime());

      await expect(
        service.redeem({ token: invite.token, userId: GUEST_ID }),
      ).rejects.toBeInstanceOf(InviteExpiredError);
    });

    it("rejects a revoked invite", async () => {
      const invite = await createInvite();
      await service.revoke({ inviteId: invite.id, requesterId: OWNER_ID });

      await expect(
        service.redeem({ token: invite.token, userId: GUEST_ID }),
      ).rejects.toBeInstanceOf(InviteRevokedError);
      expect(membership.granted).toEqual([]);
    });

    it("rejects an invite whose resource has since vanished", async () => {
      const invite = await createInvite();
      membership.existing.delete(PLAYLIST_ID);

      await expect(
        service.redeem({ token: invite.token, userId: GUEST_ID }),
      ).rejects.toBeInstanceOf(InviteResourceNotFoundError);
    });
  });

  describe("revoke", () => {
    it("stops the link from being redeemed", async () => {
      const invite = await createInvite();

      await service.revoke({ inviteId: invite.id, requesterId: OWNER_ID });

      const stored = await repository.findById(invite.id);
      expect(stored?.revokedAt).not.toBeNull();
    });

    it("refuses someone who may not manage the resource", async () => {
      const invite = await createInvite();

      await expect(
        service.revoke({ inviteId: invite.id, requesterId: GUEST_ID }),
      ).rejects.toBeInstanceOf(InviteForbiddenError);
    });

    it("rejects an unknown invite", async () => {
      await expect(
        service.revoke({ inviteId: "missing", requesterId: OWNER_ID }),
      ).rejects.toBeInstanceOf(InviteNotFoundError);
    });

    it("is idempotent", async () => {
      const invite = await createInvite();

      await service.revoke({ inviteId: invite.id, requesterId: OWNER_ID });
      await expect(
        service.revoke({ inviteId: invite.id, requesterId: OWNER_ID }),
      ).resolves.toBeUndefined();
    });
  });

  describe("listForResource", () => {
    it("lists the resource's invites, newest first", async () => {
      await createInvite();
      await createInvite();

      const listed = await service.listForResource({
        resourceType: "PLAYLIST",
        resourceId: PLAYLIST_ID,
        requesterId: OWNER_ID,
      });

      expect(listed.map((invite) => invite.token)).toEqual([TOKEN_2, TOKEN_1]);
    });

    it("refuses someone who may not manage the resource", async () => {
      await expect(
        service.listForResource({
          resourceType: "PLAYLIST",
          resourceId: PLAYLIST_ID,
          requesterId: GUEST_ID,
        }),
      ).rejects.toBeInstanceOf(InviteForbiddenError);
    });
  });

  describe("resource routing", () => {
    it("uses the adapter registered for the invite's resource type", async () => {
      const invite = await service.createForResource({
        resourceType: "ROOM",
        resourceId: PLAYLIST_ID,
        inviterId: OWNER_ID,
      });

      await service.redeem({ token: invite.token, userId: GUEST_ID });

      // The ROOM adapter got it; the PLAYLIST one was never touched.
      expect(roomMembership.granted).toEqual([
        { resourceId: PLAYLIST_ID, userId: GUEST_ID },
      ]);
      expect(membership.granted).toEqual([]);
    });
  });
});
