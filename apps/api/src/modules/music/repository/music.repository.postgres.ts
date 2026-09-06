import { desc, eq } from "drizzle-orm";
import type { Database } from "../../../shared/db/database.js";
import { musics } from "../../../shared/db/schema/musics.js";
import type { MusicRepository } from "./music.repository.js";

/**
 * Postgres adapter for {@link MusicRepository} — the only code that reads/writes
 * the `musics` table via Drizzle (Repository pattern, ADR 0014). A factory taking
 * an injected {@link Database} (ADR 0026/0027), integration-tested against a real
 * Postgres (ADR 0015).
 */
export function createPostgresMusicRepository(db: Database): MusicRepository {
  return {
    async create(input) {
      const [music] = await db.insert(musics).values(input).returning();

      if (music === undefined) {
        throw new Error("create: expected a returned music row");
      }

      return music;
    },

    async findById(id) {
      const [music] = await db
        .select()
        .from(musics)
        .where(eq(musics.id, id))
        .limit(1);

      return music ?? null;
    },

    async list() {
      return db.select().from(musics).orderBy(desc(musics.createdAt));
    },
  };
}
