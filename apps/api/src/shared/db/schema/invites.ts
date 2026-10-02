import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Kinds of resource an invite can address (ADR 0040). `ROOM` was added in
 * ADR 0041 by doing exactly what this note predicted: extending this union and
 * the check constraint, and registering a second `ResourceMembership` adapter.
 * The invite module did not change.
 */
export const INVITE_RESOURCE_TYPES = ["PLAYLIST", "ROOM"] as const;
export type InviteResourceType = (typeof INVITE_RESOURCE_TYPES)[number];

/**
 * Invite links (ADR 0040). An invite is an opaque `token` addressing a
 * `(resource_type, resource_id)` pair; whoever redeems it becomes a MEMBER of
 * that resource.
 *
 * `resource_id` deliberately carries **no foreign key**: it points at a playlist
 * today and may point at a room tomorrow, and polymorphism is the price of not
 * duplicating this table per resource type. Redeeming therefore re-checks that
 * the resource still exists.
 *
 * The link is reusable until it expires or is revoked — who accepted is recorded
 * by the membership row, not here.
 */
export const invites = pgTable(
  "invites",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    /** Opaque bearer token, 256 bits of entropy, like a session id (ADR 0016). */
    token: text("token").notNull().unique(),
    resourceType: text("resource_type").$type<InviteResourceType>().notNull(),
    /** Id of the invited-to resource. No FK — see the note above. */
    resourceId: uuid("resource_id").notNull(),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Set when revoked; a revoked invite can never be redeemed again. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // Listing a resource's live invites, and revoking them with it.
    index("invites_resource_idx").on(table.resourceType, table.resourceId),
    check(
      "invites_resource_type_check",
      sql`${table.resourceType} in ('PLAYLIST', 'ROOM')`,
    ),
  ],
);

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
