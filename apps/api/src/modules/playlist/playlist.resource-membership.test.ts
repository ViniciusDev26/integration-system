import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryEventBus } from "../../shared/realtime/event-bus.in-memory.js";
import type { ResourceMembership } from "../invite/resource-membership.js";
import type { PlaylistEvent } from "./playlist.events.js";
import { playlistTopic } from "./playlist.events.js";
import { createPlaylistResourceMembership } from "./playlist.resource-membership.js";
import { createInMemoryPlaylistRepository } from "./repository/playlist.repository.in-memory.js";
import type { PlaylistRepository } from "./repository/playlist.repository.js";

const OWNER_ID = "user-owner";
const GUEST_ID = "user-guest";

describe("createPlaylistResourceMembership", () => {
  let repository: PlaylistRepository;
  let membership: ResourceMembership;
  let eventBus: ReturnType<typeof createInMemoryEventBus<PlaylistEvent>>;
  let playlistId: string;

  beforeEach(async () => {
    repository = createInMemoryPlaylistRepository();
    eventBus = createInMemoryEventBus<PlaylistEvent>();
    membership = createPlaylistResourceMembership({
      playlistRepository: repository,
      eventBus,
    });
    const playlist = await repository.create({
      name: "Shared",
      ownerId: OWNER_ID,
    });
    playlistId = playlist.id;
  });

  describe("exists", () => {
    it("is true for a playlist that is there", async () => {
      expect(await membership.exists(playlistId)).toBe(true);
    });

    it("is false for an unknown id", async () => {
      expect(await membership.exists("playlist-gone")).toBe(false);
    });
  });

  describe("canInvite", () => {
    it("allows the OWNER", async () => {
      expect(await membership.canInvite(playlistId, OWNER_ID)).toBe(true);
    });

    it("refuses a non-member", async () => {
      expect(await membership.canInvite(playlistId, GUEST_ID)).toBe(false);
    });

    it("refuses a MEMBER — only the owner may invite", async () => {
      await membership.grant(playlistId, GUEST_ID);

      expect(await membership.canInvite(playlistId, GUEST_ID)).toBe(false);
    });
  });

  describe("grant", () => {
    it("adds the user as MEMBER", async () => {
      await membership.grant(playlistId, GUEST_ID);

      expect(await repository.getMemberType(playlistId, GUEST_ID)).toBe(
        "MEMBER",
      );
    });

    it("makes the playlist show up in the guest's list", async () => {
      expect(await repository.listForMember(GUEST_ID)).toEqual([]);

      await membership.grant(playlistId, GUEST_ID);

      expect(
        (await repository.listForMember(GUEST_ID)).map((p) => p.id),
      ).toEqual([playlistId]);
    });

    it("is idempotent", async () => {
      await membership.grant(playlistId, GUEST_ID);
      await membership.grant(playlistId, GUEST_ID);

      expect(await repository.listForMember(GUEST_ID)).toHaveLength(1);
    });

    it("does not demote an OWNER who redeems their own link", async () => {
      await membership.grant(playlistId, OWNER_ID);

      expect(await repository.getMemberType(playlistId, OWNER_ID)).toBe(
        "OWNER",
      );
      expect(await membership.canInvite(playlistId, OWNER_ID)).toBe(true);
    });

    it("announces a real join, once", async () => {
      const seen: PlaylistEvent[] = [];
      const controller = new AbortController();
      const drained = (async () => {
        for await (const event of eventBus.subscribe(
          playlistTopic(playlistId),
          { signal: controller.signal },
        )) {
          seen.push(event);
        }
      })();

      await membership.grant(playlistId, GUEST_ID);
      // A repeat redeem must not announce an arrival again.
      await membership.grant(playlistId, GUEST_ID);
      await new Promise((resolve) => setImmediate(resolve));
      controller.abort();
      await drained;

      expect(seen).toEqual([
        {
          type: "MEMBER_JOINED",
          playlistId,
          actorId: GUEST_ID,
        },
      ]);
    });
  });
});
