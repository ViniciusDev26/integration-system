import type { Music } from "../../shared/db/schema/musics.js";
import type { CreateMusicInput, MusicRepository } from "./music.repository.js";

/**
 * In-memory fake of {@link MusicRepository} for unit-testing services
 * (ADR 0022/0027). Insertion order is tracked so `list` can return newest-first
 * like the postgres adapter, without relying on identical timestamps. Not shipped
 * in the build.
 */
export function createInMemoryMusicRepository(): MusicRepository {
  const musicsById = new Map<string, Music>();
  const insertionOrder: string[] = [];
  let sequence = 0;

  return {
    async create(input: CreateMusicInput) {
      sequence += 1;
      const now = new Date();
      const music: Music = {
        id: `music-${sequence}`,
        name: input.name,
        genre: input.genre,
        objectKey: input.objectKey,
        thumbnailObjectKey: input.thumbnailObjectKey,
        uploadedBy: input.uploadedBy,
        createdAt: now,
        updatedAt: now,
      };
      musicsById.set(music.id, music);
      insertionOrder.push(music.id);
      return music;
    },

    async findById(id) {
      return musicsById.get(id) ?? null;
    },

    async list() {
      return insertionOrder
        .map((id) => musicsById.get(id))
        .filter((music): music is Music => music !== undefined)
        .reverse();
    },
  };
}
