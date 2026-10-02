/** A message with the little about its author the UI needs to render it. */
export interface RoomMessageSummary {
  /** UUIDv7 — time-ordered, and therefore also the replay cursor (ADR 0044). */
  id: string;
  roomId: string;
  userId: string;
  authorName: string | null;
  authorImageUrl: string | null;
  body: string;
  createdAt: Date;
}

export interface CreateRoomMessageInput {
  roomId: string;
  userId: string;
  body: string;
}

export interface ListMessagesAfterInput {
  roomId: string;
  /** Exclusive cursor — the last id the client already has. */
  afterId: string;
  limit: number;
}

/**
 * Port for chat persistence (ADR 0044, ADR 0027).
 *
 * Reads come in two shapes because the subscription needs both: `listRecent`
 * for the history a client sees on arrival, and `listAfter` for the gap a
 * reconnecting client missed.
 */
export interface RoomMessageRepository {
  create(input: CreateRoomMessageInput): Promise<RoomMessageSummary>;
  /** The newest `limit` messages, returned **oldest first** for rendering. */
  listRecent(roomId: string, limit: number): Promise<RoomMessageSummary[]>;
  /** Messages after `afterId`, oldest first — the reconnect backfill. */
  listAfter(input: ListMessagesAfterInput): Promise<RoomMessageSummary[]>;
}
