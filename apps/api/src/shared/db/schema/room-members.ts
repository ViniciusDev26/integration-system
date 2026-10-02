import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { rooms } from "./rooms.js";
import { users } from "./users.js";

/**
 * Membership roles in a room (ADR 0041), mirroring `playlist_members`. `OWNER`
 * created it; `MEMBER` joined, normally by redeeming an invite (ADR 0040).
 *
 * Membership is who *may* enter. Who *is here now* is presence, held in the
 * in-memory `RoomRegistry` for as long as a subscription stays open.
 */
export const ROOM_MEMBER_TYPES = ["OWNER", "MEMBER"] as const;
export type RoomMemberType = (typeof ROOM_MEMBER_TYPES)[number];

export const roomMembers = pgTable(
  "room_members",
  {
    roomId: uuid("room_id")
      .notNull()
      .references(() => rooms.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<RoomMemberType>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.roomId, table.userId] }),
    index("room_members_user_id_idx").on(table.userId),
    check("room_members_type_check", sql`${table.type} in ('OWNER', 'MEMBER')`),
  ],
);

export type RoomMember = typeof roomMembers.$inferSelect;
export type NewRoomMember = typeof roomMembers.$inferInsert;
