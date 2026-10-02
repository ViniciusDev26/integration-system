import type { Music } from "../../../shared/db/schema/musics.js";
import type { PlaylistMemberType } from "../../../shared/db/schema/playlist-members.js";
import type { Playlist } from "../../../shared/db/schema/playlists.js";

/** Data to create a playlist. The creator becomes its `OWNER` member. */
export interface CreatePlaylistInput {
  name: string;
  /** `users.id` of the creator — inserted as the OWNER membership row. */
  ownerId: string;
}

export interface AddMusicInput {
  playlistId: string;
  musicId: string;
}

/** Data to add a membership row. */
export interface AddMemberInput {
  playlistId: string;
  userId: string;
  type: PlaylistMemberType;
}

/**
 * Port for playlist persistence (ADR 0014, ADR 0027). Ownership/membership is a
 * relation (`playlist_members`), so `create` also inserts the OWNER row and
 * `getMemberType` answers "what role does this user have here?" for authorization
 * in the service. Adapters: `createPostgresPlaylistRepository` (production) and an
 * in-memory fake (tests).
 */
export interface PlaylistRepository {
  /** Creates the playlist and its OWNER membership atomically. */
  create(input: CreatePlaylistInput): Promise<Playlist>;
  findById(id: string): Promise<Playlist | null>;
  /**
   * Playlists the user belongs to in any role, newest first — so a playlist
   * they were invited into appears beside the ones they created (ADR 0040).
   */
  listForMember(userId: string): Promise<Playlist[]>;
  /**
   * Adds a membership row. A no-op if the user already belongs, which keeps an
   * OWNER from being demoted when they redeem their own invite link.
   */
  addMember(input: AddMemberInput): Promise<void>;
  /** The user's role in the playlist, or `null` if they are not a member. */
  getMemberType(
    playlistId: string,
    userId: string,
  ): Promise<PlaylistMemberType | null>;
  /** Adds a track to the playlist; a no-op if it is already there. */
  addMusic(input: AddMusicInput): Promise<void>;
  /** The playlist's tracks, in the order they were added. */
  listMusics(playlistId: string): Promise<Music[]>;
}
