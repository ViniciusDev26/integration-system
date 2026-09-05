import type { Music } from "../../shared/db/schema/musics.js";

/**
 * Data needed to persist a music track. The audio itself already lives in object
 * storage; `objectKey` is the storage key to stream it back (ADR 0031).
 */
export interface CreateMusicInput {
  name: string;
  genre: string;
  objectKey: string;
  /** `users.id` of the uploader. */
  uploadedBy: string;
}

/**
 * Port for music persistence (ADR 0014, ADR 0027). Adapters:
 * `createPostgresMusicRepository` (production) and an in-memory fake (tests).
 */
export interface MusicRepository {
  create(input: CreateMusicInput): Promise<Music>;
  findById(id: string): Promise<Music | null>;
  /** All tracks, newest first (listing is not user-scoped). */
  list(): Promise<Music[]>;
}
