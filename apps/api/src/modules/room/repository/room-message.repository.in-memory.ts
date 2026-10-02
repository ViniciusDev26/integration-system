import type {
  RoomMessageRepository,
  RoomMessageSummary,
} from "./room-message.repository.js";

export interface InMemoryRoomMessageRepositoryOptions {
  /** Resolves an author's display fields; defaults to none. */
  resolveAuthor?: (userId: string) => {
    name: string | null;
    imageUrl: string | null;
  };
}

/**
 * In-memory {@link RoomMessageRepository} for unit tests (ADR 0027).
 *
 * Ids are a zero-padded counter rather than real UUIDv7s — what the cursor
 * logic needs is that ids **sort by creation order**, which this preserves, and
 * the Postgres adapter has its own test proving UUIDv7 does too.
 */
export function createInMemoryRoomMessageRepository(
  options: InMemoryRoomMessageRepositoryOptions = {},
): RoomMessageRepository {
  const rows: RoomMessageSummary[] = [];
  let sequence = 0;

  function forRoom(roomId: string): RoomMessageSummary[] {
    return rows.filter((row) => row.roomId === roomId);
  }

  return {
    async create(input) {
      sequence += 1;
      const author = options.resolveAuthor?.(input.userId);
      const message: RoomMessageSummary = {
        id: `msg-${String(sequence).padStart(6, "0")}`,
        roomId: input.roomId,
        userId: input.userId,
        authorName: author?.name ?? null,
        authorImageUrl: author?.imageUrl ?? null,
        body: input.body,
        createdAt: new Date(),
      };
      rows.push(message);
      return message;
    },

    async listRecent(roomId, limit) {
      return forRoom(roomId).slice(-limit);
    },

    async listAfter({ roomId, afterId, limit }) {
      return forRoom(roomId)
        .filter((row) => row.id > afterId)
        .slice(0, limit);
    },
  };
}
