import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Uploaded music tracks (ADR 0007/0031). The audio bytes live in object storage
 * (R2); this row holds only metadata plus `objectKey`, the storage key used to
 * stream the file back via a presigned URL.
 *
 * `id` is a PostgreSQL 18 native UUIDv7 (ADR 0025). `genres` is a free-text array
 * (open-ended; a track can have many, e.g. "Pop music", "Hip hop music").
 * `objectKey` points at the audio; `thumbnailObjectKey` (nullable — thumbnails
 * are optional) points at the cover image. `uploadedBy` records who uploaded it;
 * tracks are removed with their uploader.
 */
export const musics = pgTable(
  "musics",
  {
    id: uuid("id").primaryKey().default(sql`uuidv7()`),
    name: text("name").notNull(),
    genres: text("genres").array().notNull().default(sql`'{}'`),
    objectKey: text("object_key").notNull(),
    thumbnailObjectKey: text("thumbnail_object_key"),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("musics_uploaded_by_idx").on(table.uploadedBy)],
);

export type Music = typeof musics.$inferSelect;
export type NewMusic = typeof musics.$inferInsert;
