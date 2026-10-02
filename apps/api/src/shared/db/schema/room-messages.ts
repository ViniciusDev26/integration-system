import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { rooms } from "./rooms.js";
import { users } from "./users.js";

/** Bounds on a message body (ADR 0044). */
export const MESSAGE_MIN_LENGTH = 1;
export const MESSAGE_MAX_LENGTH = 2000;

/**
 * Chat messages in a room (ADR 0044).
 *
 * Unlike playlist and room events, these are **the data, not a signal** — a
 * message missed during a reconnect is content lost. They are therefore stored,
 * and `id` doubles as the replay cursor: UUIDv7 is time-ordered, so both
 * Postgres's `uuid` comparison and `tracked(id, …)` on the wire agree about
 * what "after this one" means, with no separate sequence column.
 */
export const roomMessages = pgTable(
  "room_messages",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    /** The author. Their messages go when the account does. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Backfill reads one room in id order; this is the index that serves it.
    index("room_messages_room_id_id_idx").on(table.roomId, table.id),
    check(
      "room_messages_body_length_check",
      sql`char_length(${table.body}) between ${sql.raw(String(MESSAGE_MIN_LENGTH))} and ${sql.raw(String(MESSAGE_MAX_LENGTH))}`,
    ),
  ],
);

export type RoomMessage = typeof roomMessages.$inferSelect;
