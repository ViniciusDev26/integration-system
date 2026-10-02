import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { Database } from "../../../shared/db/database.js";
import { roomMessages } from "../../../shared/db/schema/room-messages.js";
import { users } from "../../../shared/db/schema/users.js";
import type { RoomMessageRepository } from "./room-message.repository.js";

/** The author fields every read joins in. */
const messageColumns = {
  id: roomMessages.id,
  roomId: roomMessages.roomId,
  userId: roomMessages.userId,
  authorName: users.name,
  authorImageUrl: users.imageUrl,
  body: roomMessages.body,
  createdAt: roomMessages.createdAt,
};

/**
 * Postgres adapter for {@link RoomMessageRepository} (ADR 0044, ADR 0014).
 * Integration-tested against a real Postgres (ADR 0015).
 */
export function createPostgresRoomMessageRepository(
  db: Database,
): RoomMessageRepository {
  return {
    async create(input) {
      const [inserted] = await db
        .insert(roomMessages)
        .values(input)
        .returning({ id: roomMessages.id });

      if (inserted === undefined) {
        throw new Error("create: expected a returned message row");
      }

      const [message] = await db
        .select(messageColumns)
        .from(roomMessages)
        .innerJoin(users, eq(users.id, roomMessages.userId))
        .where(eq(roomMessages.id, inserted.id))
        .limit(1);

      if (message === undefined) {
        throw new Error("create: inserted message could not be read back");
      }

      return message;
    },

    async listRecent(roomId, limit) {
      // Newest first to take the tail, then flipped so the caller renders in
      // reading order.
      const newestFirst = await db
        .select(messageColumns)
        .from(roomMessages)
        .innerJoin(users, eq(users.id, roomMessages.userId))
        .where(eq(roomMessages.roomId, roomId))
        .orderBy(desc(roomMessages.id))
        .limit(limit);

      return newestFirst.reverse();
    },

    async listAfter({ roomId, afterId, limit }) {
      // `id > afterId` works because UUIDv7 sorts by creation time (ADR 0044).
      return db
        .select(messageColumns)
        .from(roomMessages)
        .innerJoin(users, eq(users.id, roomMessages.userId))
        .where(
          and(eq(roomMessages.roomId, roomId), gt(roomMessages.id, afterId)),
        )
        .orderBy(asc(roomMessages.id))
        .limit(limit);
    },
  };
}
