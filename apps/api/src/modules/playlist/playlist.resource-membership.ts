import type { ResourceMembership } from "../invite/resource-membership.js";
import type { PlaylistEventBus } from "./playlist.events.js";
import { playlistTopic } from "./playlist.events.js";
import type { PlaylistRepository } from "./repository/playlist.repository.js";

export interface PlaylistResourceMembershipOptions {
  playlistRepository: PlaylistRepository;
  /** Where a new member is announced to the ones already watching. */
  eventBus: PlaylistEventBus;
}

/**
 * Playlist adapter for the invite module's {@link ResourceMembership} port
 * (ADR 0040). This file is the entire coupling between invites and playlists:
 * the invite module depends on the port, never on this.
 *
 * Only an `OWNER` may invite, and a redeemed invite grants `MEMBER` — the two
 * roles `playlist_members` already has (ADR 0018).
 */
export function createPlaylistResourceMembership(
  options: PlaylistResourceMembershipOptions,
): ResourceMembership {
  const { playlistRepository, eventBus } = options;

  return {
    async exists(resourceId) {
      return (await playlistRepository.findById(resourceId)) !== null;
    },

    async canInvite(resourceId, userId) {
      return (
        (await playlistRepository.getMemberType(resourceId, userId)) === "OWNER"
      );
    },

    async grant(resourceId, userId) {
      // Idempotent by the port's contract; `addMember` keeps an existing role,
      // so an OWNER redeeming their own link is not demoted.
      const joined = await playlistRepository.addMember({
        playlistId: resourceId,
        userId,
        type: "MEMBER",
      });

      // Only a real join is announced — redeeming a link twice is normal and
      // should not tell everyone someone arrived again.
      if (joined) {
        eventBus.publish(playlistTopic(resourceId), {
          type: "MEMBER_JOINED",
          playlistId: resourceId,
          actorId: userId,
        });
      }
    },
  };
}
