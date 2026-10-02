import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { musics } from "./musics.js";

/**
 * Listening rooms (ADR 0041). A room is its own resource — it owns its track
 * list and its membership rather than viewing a playlist's.
 *
 * The four playback columns are an **anchor, not a clock**: the server never
 * ticks. A client derives the live position as
 * `isPlaying ? positionMs + (now - playbackUpdatedAt) : positionMs`, so these
 * are written only when somebody plays, pauses, seeks or changes track.
 */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    /**
     * The track the room is on, or null before anything has been played. Set to
     * null rather than cascading if the track is deleted, so the room survives.
     */
    currentMusicId: uuid("current_music_id").references(() => musics.id, {
      onDelete: "set null",
    }),
    /** Position within the current track, in ms, at {@link playbackUpdatedAt}. */
    positionMs: integer("position_ms").notNull().default(0),
    isPlaying: boolean("is_playing").notNull().default(false),
    /** When the anchor above was last set — the instant clients extrapolate from. */
    playbackUpdatedAt: timestamp("playback_updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [check("rooms_position_ms_check", sql`${table.positionMs} >= 0`)],
);

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

/** The playback anchor on its own — what a command writes and an event carries. */
export interface PlaybackAnchor {
  currentMusicId: string | null;
  positionMs: number;
  isPlaying: boolean;
  playbackUpdatedAt: Date;
}
