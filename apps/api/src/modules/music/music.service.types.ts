import type { Music } from "../../shared/db/schema/musics.js";
import type { ObjectStorage } from "../../shared/storage/object-storage.js";
import type { MusicRepository } from "./music.repository.js";

/** An uploaded file the service needs — a structural subset of a multer file. */
export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}

export interface RegisterMusicInput {
  name: string;
  genres: string[];
  file: UploadedFile;
  /** Optional cover image. */
  thumbnail?: UploadedFile;
  /** `users.id` of the uploader. */
  uploadedBy: string;
}

/** Client-declared metadata for a file about to be uploaded (ADR 0038). */
export interface FileMeta {
  filename: string;
  contentType: string;
}

export interface PrepareUploadInput {
  audio: FileMeta;
  thumbnail?: FileMeta;
}

/** A presigned PUT target: where to upload and the key to reference afterwards. */
export interface UploadTarget {
  objectKey: string;
  uploadUrl: string;
}

export interface PrepareUploadResult {
  audio: UploadTarget;
  thumbnail?: UploadTarget;
}

/** Persist a track from already-uploaded object keys (ADR 0038). */
export interface CreateFromKeysInput {
  name: string;
  genres: string[];
  objectKey: string;
  thumbnailObjectKey: string | null;
  uploadedBy: string;
}

/** A music track plus ready-to-use URLs, shaped for listing (no storage keys). */
export interface MusicListItem {
  id: string;
  name: string;
  genres: string[];
  /** Short-lived presigned URL to stream the audio (ADR 0031). */
  playbackUrl: string;
  /** Short-lived presigned URL for the cover image, or `null` if none. */
  thumbnailUrl: string | null;
}

export interface MusicServiceOptions {
  musicRepository: MusicRepository;
  objectStorage: ObjectStorage;
  /**
   * Audio storage key generator (from the upload filename), injectable for
   * deterministic tests. Defaults to `musics/<uuid><ext>`.
   */
  generateObjectKey?: (filename: string) => string;
  /**
   * Thumbnail storage key generator. Defaults to `musics/thumbnails/<uuid><ext>`.
   */
  generateThumbnailKey?: (filename: string) => string;
}

/**
 * Orchestrates music (ADR 0031/0038):
 * - `register`: server-side upload (bytes → storage, then row) — used by the seed.
 * - `prepareUpload` + `createFromKeys`: the browser's presigned direct-upload flow
 *   (issue PUT URLs, then persist the row from the resulting keys).
 * - `listAll`: all tracks with presigned playback/thumbnail URLs.
 */
export interface MusicService {
  register(input: RegisterMusicInput): Promise<Music>;
  prepareUpload(input: PrepareUploadInput): Promise<PrepareUploadResult>;
  createFromKeys(input: CreateFromKeysInput): Promise<Music>;
  listAll(): Promise<MusicListItem[]>;
}
