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
import { playlists } from "./playlists.js";
import { users } from "./users.js";

/**
 * Membership roles in a playlist. `OWNER` created it (exactly one, enforced by
 * the service); `MEMBER` is reserved for future shared/collaborative playlists.
 */
export const PLAYLIST_MEMBER_TYPES = ["OWNER", "MEMBER"] as const;
export type PlaylistMemberType = (typeof PLAYLIST_MEMBER_TYPES)[number];

/**
 * Who belongs to a playlist and in what role (ADR 0018). Modeled as a relation
 * (not an `owner_id` column) so ownership generalizes to membership later. One
 * row per (playlist, user); the `type` is constrained to {@link PLAYLIST_MEMBER_TYPES}.
 */
export const playlistMembers = pgTable(
  "playlist_members",
  {
    playlistId: uuid("playlist_id")
      .notNull()
      .references(() => playlists.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<PlaylistMemberType>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.userId] }),
    index("playlist_members_user_id_idx").on(table.userId),
    check(
      "playlist_members_type_check",
      sql`${table.type} in ('OWNER', 'MEMBER')`,
    ),
  ],
);

export type PlaylistMember = typeof playlistMembers.$inferSelect;
export type NewPlaylistMember = typeof playlistMembers.$inferInsert;
