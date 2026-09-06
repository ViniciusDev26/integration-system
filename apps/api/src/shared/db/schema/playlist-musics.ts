import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { musics } from "./musics.js";
import { playlists } from "./playlists.js";

/**
 * Tracks in a playlist (ADR 0018): a many-to-many link between `playlists` and
 * `musics`. One row per (playlist, music) — the composite primary key makes a
 * track appear at most once per playlist.
 */
export const playlistMusics = pgTable(
  "playlist_musics",
  {
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    musicId: uuid("music_id")
      .notNull()
      .references(() => musics.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.musicId] }),
    index("playlist_musics_music_id_idx").on(table.musicId),
  ],
);

export type PlaylistMusic = typeof playlistMusics.$inferSelect;
export type NewPlaylistMusic = typeof playlistMusics.$inferInsert;
