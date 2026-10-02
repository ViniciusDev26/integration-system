import {
  mediaCoverPath,
  mediaPlaybackPath,
} from "../../media/media.constants.js";
import { playlistTopic } from "../playlist.events.js";
import {
  MusicNotFoundError,
  PlaylistForbiddenError,
  PlaylistNotFoundError,
} from "./playlist.service.errors.js";
import type {
  PlaylistService,
  PlaylistServiceOptions,
} from "./playlist.service.types.js";

export function createPlaylistService(
  options: PlaylistServiceOptions,
): PlaylistService {
  const { playlistRepository, musicRepository, objectStorage, eventBus } =
    options;

  /** Loads a playlist the requester may access, or throws NotFound/Forbidden. */
  async function requireMembership(playlistId: string, requesterId: string) {
    const playlist = await playlistRepository.findById(playlistId);
    if (playlist === null) {
      throw new PlaylistNotFoundError(playlistId);
    }
    const role = await playlistRepository.getMemberType(
      playlistId,
      requesterId,
    );
    if (role === null) {
      throw new PlaylistForbiddenError(playlistId);
    }
    return playlist;
  }

  return {
    async createForUser({ name, ownerId }) {
      return playlistRepository.create({ name, ownerId });
    },

    async listForUser(userId) {
      return playlistRepository.listForMember(userId);
    },

    async addMusic({ playlistId, musicId, requesterId }) {
      await requireMembership(playlistId, requesterId);

      const music = await musicRepository.findById(musicId);
      if (music === null) {
        throw new MusicNotFoundError(musicId);
      }

      await playlistRepository.addMusic({ playlistId, musicId });

      // Announced only after the write lands, so a member never hears about a
      // change that did not happen.
      eventBus.publish(playlistTopic(playlistId), {
        type: "MUSIC_ADDED",
        playlistId,
        musicId,
        actorId: requesterId,
      });
    },

    async listMembers({ playlistId, requesterId }) {
      await requireMembership(playlistId, requesterId);
      return playlistRepository.listMembers(playlistId);
    },

    async watch({ playlistId, requesterId, signal }) {
      await requireMembership(playlistId, requesterId);
      return eventBus.subscribe(playlistTopic(playlistId), { signal });
    },

    async getWithMusics({ playlistId, requesterId }) {
      const playlist = await requireMembership(playlistId, requesterId);

      const tracks = await playlistRepository.listMusics(playlistId);
      const musics = await Promise.all(
        tracks.map(async (track) => ({
          id: track.id,
          name: track.name,
          genres: track.genres,
          playbackUrl: mediaPlaybackPath(track.id),
          thumbnailUrl:
            track.thumbnailObjectKey === null ? null : mediaCoverPath(track.id),
        })),
      );

      return { playlist, musics };
    },
  };
}
