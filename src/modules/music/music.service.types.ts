import type { Music } from "../../shared/db/schema/musics.js";
import type { ObjectStorage } from "../../shared/storage/object-storage.js";
import type { MusicRepository } from "./music.repository.js";

/** The uploaded audio the service needs — a structural subset of a multer file. */
export interface UploadedAudio {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface RegisterMusicInput {
  name: string;
  genre: string;
  file: UploadedAudio;
  /** `users.id` of the uploader. */
  uploadedBy: string;
}

/** A music track plus a ready-to-play URL, shaped for listing (no storage key). */
export interface MusicListItem {
  id: string;
  name: string;
  genre: string;
  /** Short-lived presigned URL to stream the audio (ADR 0031). */
  playbackUrl: string;
}

export interface MusicServiceOptions {
  musicRepository: MusicRepository;
  objectStorage: ObjectStorage;
  /**
   * Storage key generator, injectable for deterministic tests. Defaults to
   * `musics/<uuid><ext>`.
   */
  generateObjectKey?: (file: UploadedAudio) => string;
}

/**
 * Orchestrates music creation (ADR 0031): store the audio bytes in object
 * storage, then persist the metadata row referencing the storage key.
 */
export interface MusicService {
  register(input: RegisterMusicInput): Promise<Music>;
  /**
   * All tracks (newest first, not user-scoped), each with a fresh presigned
   * playback URL for streaming from object storage.
   */
  listAll(): Promise<MusicListItem[]>;
}
