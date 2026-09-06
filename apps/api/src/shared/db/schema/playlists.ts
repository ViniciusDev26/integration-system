import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A playlist (ADR 0018). Ownership and (future) membership are NOT columns here —
 * they live in `playlist_members`, so a playlist can grow from a single owner to
 * shared/collaborative membership without a schema change. Tracks are linked via
 * `playlist_musics`.
 *
 * `id` is a PostgreSQL 18 native UUIDv7 (ADR 0025).
 */
export const playlists = pgTable("playlists", {
  id: uuid("id").primaryKey().default(sql`uuidv7()`),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Playlist = typeof playlists.$inferSelect;
export type NewPlaylist = typeof playlists.$inferInsert;
