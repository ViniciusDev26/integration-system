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
  const { playlistRepository, musicRepository, objectStorage } = options;

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

    async listForUser(ownerId) {
      return playlistRepository.listByOwner(ownerId);
    },

    async addMusic({ playlistId, musicId, requesterId }) {
      await requireMembership(playlistId, requesterId);

      const music = await musicRepository.findById(musicId);
      if (music === null) {
        throw new MusicNotFoundError(musicId);
      }

      await playlistRepository.addMusic({ playlistId, musicId });
    },

    async getWithMusics({ playlistId, requesterId }) {
      const playlist = await requireMembership(playlistId, requesterId);

      const tracks = await playlistRepository.listMusics(playlistId);
      const musics = await Promise.all(
        tracks.map(async (track) => ({
          id: track.id,
          name: track.name,
          genres: track.genres,
          playbackUrl: await objectStorage.getSignedUrl(track.objectKey),
          thumbnailUrl:
            track.thumbnailObjectKey === null
              ? null
              : await objectStorage.getSignedUrl(track.thumbnailObjectKey),
        })),
      );

      return { playlist, musics };
    },
  };
}
