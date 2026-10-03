import type { Music } from "../../../shared/db/schema/musics.js";
import type { RoomMemberType } from "../../../shared/db/schema/room-members.js";
import type { Room } from "../../../shared/db/schema/rooms.js";
import type { RoomRepository } from "./room.repository.js";

export interface InMemoryRoomRepositoryOptions {
  /** Resolves a music id to a full row so `listMusics` returns `Music[]`. */
  resolveMusic?: (id: string) => Promise<Music | null | undefined>;
  /** Resolves a user id to a display name for `listMembers`. */
  resolveUserName?: (userId: string) => string | null;
}

/**
 * In-memory fake of {@link RoomRepository} for unit tests (ADR 0022/0027).
 * Mirrors the Postgres adapter's observable behaviour: newest-first listing,
 * idempotent membership that reports whether it inserted, and a playback anchor
 * that is simply overwritten.
 */
export function createInMemoryRoomRepository(
  options: InMemoryRoomRepositoryOptions = {},
): RoomRepository {
  const resolveMusic =
    options.resolveMusic ?? (() => Promise.resolve(undefined));

  const roomsById = new Map<string, Room>();
  const creationOrder: string[] = [];
  const members: Array<{
    roomId: string;
    userId: string;
    type: RoomMemberType;
  }> = [];
  const queued: Array<{ roomId: string; musicId: string }> = [];
  let sequence = 0;

  return {
    async create(input) {
      sequence += 1;
      const now = new Date();
      const room: Room = {
        id: `room-${sequence}`,
        name: input.name,
        currentMusicId: null,
        positionMs: 0,
        isPlaying: false,
        playbackUpdatedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      roomsById.set(room.id, room);
      creationOrder.push(room.id);
      members.push({ roomId: room.id, userId: input.ownerId, type: "OWNER" });
      return room;
    },

    async findById(id) {
      return roomsById.get(id) ?? null;
    },

    async listForMember(userId) {
      const belongsTo = new Set(
        members.filter((m) => m.userId === userId).map((m) => m.roomId),
      );
      return creationOrder
        .filter((id) => belongsTo.has(id))
        .map((id) => roomsById.get(id))
        .filter((room): room is Room => room !== undefined)
        .reverse();
    },

    async getMemberType(roomId, userId) {
      return (
        members.find((m) => m.roomId === roomId && m.userId === userId)?.type ??
        null
      );
    },

    async addMember(input) {
      const already = members.some(
        (m) => m.roomId === input.roomId && m.userId === input.userId,
      );
      if (already) {
        return false;
      }
      members.push(input);
      return true;
    },

    async listMembers(roomId) {
      return members
        .filter((m) => m.roomId === roomId)
        .map((m) => ({
          userId: m.userId,
          type: m.type,
          name: options.resolveUserName?.(m.userId) ?? null,
          imageUrl: null,
        }));
    },

    async addMusic(input) {
      const already = queued.some(
        (q) => q.roomId === input.roomId && q.musicId === input.musicId,
      );
      if (!already) {
        queued.push(input);
      }
    },

    async listMusics(roomId) {
      const found = await Promise.all(
        queued
          .filter((q) => q.roomId === roomId)
          .map((q) => resolveMusic(q.musicId)),
      );
      return found.filter((music): music is Music => music != null);
    },

    async setPlayback(roomId, anchor) {
      const room = roomsById.get(roomId);
      if (room === undefined) {
        return null;
      }
      const updated: Room = { ...room, ...anchor, updatedAt: new Date() };
      roomsById.set(roomId, updated);
      return updated;
    },

    async advancePlayback(roomId, fromMusicId, anchor) {
      // Mirrors the Postgres adapter's compare-and-swap: a report naming a
      // track the room has already left changes nothing.
      const room = roomsById.get(roomId);
      if (room === undefined || room.currentMusicId !== fromMusicId) {
        return null;
      }
      const updated: Room = { ...room, ...anchor, updatedAt: new Date() };
      roomsById.set(roomId, updated);
      return updated;
    },
  };
}
