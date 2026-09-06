import type { Playlist } from "../../shared/db/schema/playlists.js";
import type { ObjectStorage } from "../../shared/storage/object-storage.js";
import type { MusicRepository } from "../music/music.repository.js";
import type { MusicListItem } from "../music/music.service.types.js";
import type { PlaylistRepository } from "./playlist.repository.js";

export interface CreatePlaylistForUserInput {
  name: string;
  /** `users.id` of the creator (becomes the OWNER). */
  ownerId: string;
}

export interface AddMusicToPlaylistInput {
  playlistId: string;
  musicId: string;
  /** `users.id` of the user attempting the change (must be a member). */
  requesterId: string;
}

export interface GetPlaylistInput {
  playlistId: string;
  /** `users.id` of the user viewing (must be a member). */
  requesterId: string;
}

/** A playlist together with its tracks (each with presigned URLs). */
export interface PlaylistWithMusics {
  playlist: Playlist;
  musics: MusicListItem[];
}

export interface PlaylistServiceOptions {
  playlistRepository: PlaylistRepository;
  /** Used to validate a music exists before linking it. */
  musicRepository: MusicRepository;
  /** Used to presign playback/thumbnail URLs when reading a playlist. */
  objectStorage: ObjectStorage;
}

/**
 * Orchestrates playlists (ADR 0018): creation (creator becomes OWNER), adding
 * tracks (only members may), and reading a playlist with its tracks. Membership
 * is enforced here via {@link PlaylistRepository.getMemberType}; failures surface
 * as the typed errors in `playlist.service.errors.ts`.
 */
export interface PlaylistService {
  createForUser(input: CreatePlaylistForUserInput): Promise<Playlist>;
  addMusic(input: AddMusicToPlaylistInput): Promise<void>;
  /** Playlists the user owns, newest first. */
  listForUser(ownerId: string): Promise<Playlist[]>;
  getWithMusics(input: GetPlaylistInput): Promise<PlaylistWithMusics>;
}
