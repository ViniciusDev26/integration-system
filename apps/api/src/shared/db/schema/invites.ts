import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import {
  INVITE_RESOURCE_TYPES,
  type InviteResourceType,
} from "../../../modules/invite/domain/resource.js";
import { users } from "./users.js";

// The resource-type union is owned by the invite domain (ADR 0047): the table
// takes its shape from the model, not the other way round. Re-exported so
// existing persistence-side imports keep working.
export {
  INVITE_RESOURCE_TYPES,
  type InviteResourceType,
} from "../../../modules/invite/domain/resource.js";

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
      // Derived from the domain union, so adding a resource type cannot leave
      // the constraint behind (ADR 0047).
      sql`${table.resourceType} in (${sql.raw(
        INVITE_RESOURCE_TYPES.map((type) => `'${type}'`).join(", "),
      )})`,
    ),
  ],
);

export type Invite = typeof invites.$inferSelect;
export type NewInvite = typeof invites.$inferInsert;
