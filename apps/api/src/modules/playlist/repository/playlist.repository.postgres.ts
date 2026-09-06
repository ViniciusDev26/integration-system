import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../../../shared/db/database.js";
import { musics } from "../../../shared/db/schema/musics.js";
import { playlistMembers } from "../../../shared/db/schema/playlist-members.js";
import { playlistMusics } from "../../../shared/db/schema/playlist-musics.js";
import { playlists } from "../../../shared/db/schema/playlists.js";
import type { PlaylistRepository } from "./playlist.repository.js";

/**
 * Postgres adapter for {@link PlaylistRepository} — the only code that reads/writes
 * the `playlists`, `playlist_members`, and `playlist_musics` tables via Drizzle
 * (Repository pattern, ADR 0014). Integration-tested against a real Postgres
 * (ADR 0015).
 */
export function createPostgresPlaylistRepository(
  db: Database,
): PlaylistRepository {
  return {
    async create(input) {
      return db.transaction(async (tx) => {
        const [playlist] = await tx
          .insert(playlists)
          .values({ name: input.name })
          .returning();

        if (playlist === undefined) {
          throw new Error("create: expected a returned playlist row");
        }

        await tx.insert(playlistMembers).values({
          playlistId: playlist.id,
          userId: input.ownerId,
          type: "OWNER",
        });

        return playlist;
      });
    },

    async findById(id) {
      const [playlist] = await db
        .select()
        .from(playlists)
        .where(eq(playlists.id, id))
        .limit(1);

      return playlist ?? null;
    },

    async listByOwner(ownerId) {
      const rows = await db
        .select()
        .from(playlists)
        .innerJoin(
          playlistMembers,
          eq(playlistMembers.playlistId, playlists.id),
        )
        .where(
          and(
            eq(playlistMembers.userId, ownerId),
            eq(playlistMembers.type, "OWNER"),
          ),
        )
        .orderBy(desc(playlists.createdAt));

      return rows.map((row) => row.playlists);
    },

    async getMemberType(playlistId, userId) {
      const [row] = await db
        .select({ type: playlistMembers.type })
        .from(playlistMembers)
        .where(
          and(
            eq(playlistMembers.playlistId, playlistId),
            eq(playlistMembers.userId, userId),
          ),
        )
        .limit(1);

      return row?.type ?? null;
    },

    async addMusic(input) {
      await db
        .insert(playlistMusics)
        .values({ playlistId: input.playlistId, musicId: input.musicId })
        .onConflictDoNothing();
    },

    async listMusics(playlistId) {
      const rows = await db
        .select()
        .from(musics)
        .innerJoin(playlistMusics, eq(playlistMusics.musicId, musics.id))
        .where(eq(playlistMusics.playlistId, playlistId))
        .orderBy(asc(playlistMusics.addedAt));

      return rows.map((row) => row.musics);
    },
  };
}
