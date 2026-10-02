import {
  index,
  pgTable,
  primaryKey,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { musics } from "./musics.js";
import { rooms } from "./rooms.js";

/**
 * The tracks queued in a room (ADR 0041) — a many-to-many onto the existing
 * `musics`. A room owns its *association* to tracks, not the tracks themselves,
 * so nothing about a music row is duplicated.
 *
 * Ordering is by `added_at`, like `playlist_musics`.
 */
export const roomMusics = pgTable(
  "room_musics",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    musicId: uuid("music_id")
      .notNull()
      .references(() => musics.id, { onDelete: "cascade" }),
    addedAt: timestamp("added_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.musicId] }),
    index("room_musics_music_id_idx").on(table.musicId),
  ],
);

export type RoomMusic = typeof roomMusics.$inferSelect;
