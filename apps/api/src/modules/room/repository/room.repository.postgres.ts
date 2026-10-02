import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../../../shared/db/database.js";
import { musics } from "../../../shared/db/schema/musics.js";
import { roomMembers } from "../../../shared/db/schema/room-members.js";
import { roomMusics } from "../../../shared/db/schema/room-musics.js";
import { rooms } from "../../../shared/db/schema/rooms.js";
import { users } from "../../../shared/db/schema/users.js";
import type { RoomRepository } from "./room.repository.js";

/**
 * Postgres adapter for {@link RoomRepository} (ADR 0041, ADR 0014) — the only
 * code that touches `rooms`, `room_members` and `room_musics`. Integration-tested
 * against a real Postgres (ADR 0015).
 */
export function createPostgresRoomRepository(db: Database): RoomRepository {
  return {
    async create(input) {
      return db.transaction(async (tx) => {
        const [room] = await tx
          .insert(rooms)
          .values({ name: input.name })
          .returning();

        if (room === undefined) {
          throw new Error("create: expected a returned room row");
        }

        await tx.insert(roomMembers).values({
          roomId: room.id,
          userId: input.ownerId,
          type: "OWNER",
        });

        return room;
      });
    },

    async findById(id) {
      const [room] = await db
        .select()
        .from(rooms)
        .where(eq(rooms.id, id))
        .limit(1);

      return room ?? null;
    },

    async listForMember(userId) {
      const found = await db
        .select()
        .from(rooms)
        .innerJoin(roomMembers, eq(roomMembers.roomId, rooms.id))
        .where(eq(roomMembers.userId, userId))
        .orderBy(desc(rooms.createdAt), desc(rooms.id));

      return found.map((row) => row.rooms);
    },

    async getMemberType(roomId, userId) {
      const [member] = await db
        .select({ type: roomMembers.type })
        .from(roomMembers)
        .where(
          and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)),
        )
        .limit(1);

      return member?.type ?? null;
    },

    async addMember(input) {
      // The composite PK makes this idempotent; an empty `returning` is how a
      // repeated redeem is told apart from a real join.
      const inserted = await db
        .insert(roomMembers)
        .values(input)
        .onConflictDoNothing()
        .returning({ userId: roomMembers.userId });

      return inserted.length > 0;
    },

    async listMembers(roomId) {
      return db
        .select({
          userId: roomMembers.userId,
          type: roomMembers.type,
          name: users.name,
          imageUrl: users.imageUrl,
        })
        .from(roomMembers)
        .innerJoin(users, eq(users.id, roomMembers.userId))
        .where(eq(roomMembers.roomId, roomId))
        .orderBy(asc(roomMembers.createdAt), asc(roomMembers.userId));
    },

    async addMusic(input) {
      await db.insert(roomMusics).values(input).onConflictDoNothing();
    },

    async listMusics(roomId) {
      const found = await db
        .select()
        .from(roomMusics)
        .innerJoin(musics, eq(musics.id, roomMusics.musicId))
        .where(eq(roomMusics.roomId, roomId))
        .orderBy(asc(roomMusics.addedAt), asc(roomMusics.musicId));

      return found.map((row) => row.musics);
    },

    async setPlayback(roomId, anchor) {
      const [updated] = await db
        .update(rooms)
        .set(anchor)
        .where(eq(rooms.id, roomId))
        .returning();

      return updated ?? null;
    },
  };
}
