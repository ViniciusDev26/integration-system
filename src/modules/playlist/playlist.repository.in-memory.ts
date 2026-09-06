import type { Music } from "../../shared/db/schema/musics.js";
import type { PlaylistMemberType } from "../../shared/db/schema/playlist-members.js";
import type { Playlist } from "../../shared/db/schema/playlists.js";
import type {
  CreatePlaylistInput,
  PlaylistRepository,
} from "./playlist.repository.js";

export interface InMemoryPlaylistRepositoryOptions {
  /**
   * Resolves a music id to a full row so `listMusics` can return `Music[]` in
   * unit tests. Defaults to returning nothing (so `listMusics` yields `[]`).
   */
  resolveMusic?: (id: string) => Music | undefined;
}

/**
 * In-memory fake of {@link PlaylistRepository} for unit-testing services
 * (ADR 0022/0027). Tracks creation order so `listByOwner` can return newest-first
 * without relying on identical timestamps. Not shipped in the build.
 */
export function createInMemoryPlaylistRepository(
  options: InMemoryPlaylistRepositoryOptions = {},
): PlaylistRepository {
  const resolveMusic = options.resolveMusic ?? (() => undefined);

  const playlistsById = new Map<string, Playlist>();
  const creationOrder: string[] = [];
  const members: Array<{
    playlistId: string;
    userId: string;
    type: PlaylistMemberType;
  }> = [];
  const links: Array<{ playlistId: string; musicId: string }> = [];
  let sequence = 0;

  return {
    async create(input: CreatePlaylistInput) {
      sequence += 1;
      const now = new Date();
      const playlist: Playlist = {
        id: `playlist-${sequence}`,
        name: input.name,
        createdAt: now,
        updatedAt: now,
      };
      playlistsById.set(playlist.id, playlist);
      creationOrder.push(playlist.id);
      members.push({
        playlistId: playlist.id,
        userId: input.ownerId,
        type: "OWNER",
      });
      return playlist;
    },

    async findById(id) {
      return playlistsById.get(id) ?? null;
    },

    async listByOwner(ownerId) {
      const owned = new Set(
        members
          .filter((m) => m.userId === ownerId && m.type === "OWNER")
          .map((m) => m.playlistId),
      );
      return creationOrder
        .filter((id) => owned.has(id))
        .map((id) => playlistsById.get(id))
        .filter((p): p is Playlist => p !== undefined)
        .reverse();
    },

    async getMemberType(playlistId, userId) {
      const member = members.find(
        (m) => m.playlistId === playlistId && m.userId === userId,
      );
      return member?.type ?? null;
    },

    async addMusic(input) {
      const exists = links.some(
        (l) => l.playlistId === input.playlistId && l.musicId === input.musicId,
      );
      if (!exists) {
        links.push({ playlistId: input.playlistId, musicId: input.musicId });
      }
    },

    async listMusics(playlistId) {
      return links
        .filter((l) => l.playlistId === playlistId)
        .map((l) => resolveMusic(l.musicId))
        .filter((m): m is Music => m !== undefined);
    },
  };
}
