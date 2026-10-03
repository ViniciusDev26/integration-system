import type { Music } from "../../../shared/db/schema/musics.js";
import type { Room } from "../../../shared/db/schema/rooms.js";
import type { RoomRegistry } from "../../../shared/realtime/room-registry.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import type { MusicListItem } from "../../music/service/music.service.types.js";
import type { PlaybackCommand } from "../domain/room.playback.js";
import type {
  RoomMemberSummary,
  RoomRepository,
} from "../repository/room.repository.js";
import type {
  RoomMessageRepository,
  RoomMessageSummary,
} from "../repository/room-message.repository.js";
import type {
  RoomChatEventBus,
  RoomEvent,
  RoomEventBus,
} from "../room.events.js";

export interface CreateRoomForUserInput {
  name: string;
  /** `users.id` of the creator (becomes the OWNER). */
  ownerId: string;
}

export interface RoomScopedInput {
  roomId: string;
  /** `users.id` of the requester (must be a member). */
  requesterId: string;
}

export interface QueueMusicInput extends RoomScopedInput {
  musicId: string;
}

export interface CommandPlaybackInput extends RoomScopedInput {
  command: PlaybackCommand;
}

export interface ReportTrackEndedInput extends RoomScopedInput {
  /**
   * The track that finished. Only a report naming the track the room is
   * actually on can move it, so simultaneous reports advance it exactly once.
   */
  musicId: string;
}

export interface WatchRoomInput extends RoomScopedInput {
  /** Ends the stream when aborted — and, with it, the requester's presence. */
  signal?: AbortSignal;
}

/** A room with everything needed to render and join it mid-session. */
export interface RoomSnapshot {
  room: Room;
  /** Queued tracks, in order, with presigned URLs. */
  musics: MusicListItem[];
  /** `users.id` of everyone listening right now — presence, not membership. */
  present: readonly string[];
  /**
   * The server's clock when this snapshot was taken, so a client arriving
   * mid-song can measure its own clock offset before extrapolating (ADR 0041).
   */
  serverNow: Date;
}

export interface SendMessageInput extends RoomScopedInput {
  body: string;
}

export interface ListMessagesInput extends RoomScopedInput {
  limit?: number;
}

export interface WatchMessagesInput extends RoomScopedInput {
  /**
   * The id of the last message the client already has. tRPC supplies this on a
   * reconnect, from `tracked()` (ADR 0039 correction, ADR 0044). Absent on a
   * first subscribe, when history came from `listMessages` instead.
   */
  lastEventId?: string;
  signal?: AbortSignal;
}

export interface RoomServiceOptions {
  roomRepository: RoomRepository;
  /** Chat persistence (ADR 0044). */
  roomMessageRepository: RoomMessageRepository;
  /** Used to validate a track exists before queueing it. */
  musicRepository: MusicRepository;
  /** Where room changes are announced (ADR 0039). */
  eventBus: RoomEventBus;
  /** Where chat messages are announced — a separate topic (ADR 0044). */
  chatEventBus: RoomChatEventBus;
  /** Who is present right now (ADR 0039) — this is its first consumer. */
  roomRegistry: RoomRegistry;
  /** Injectable clock, so playback arithmetic is testable. */
  now?: () => Date;
}

/**
 * Orchestrates rooms (ADR 0041): membership, the shared queue, presence, and
 * server-authoritative playback. Any member may command playback — a listening
 * room is a jukebox, not a broadcast.
 */
export interface RoomService {
  createForUser(input: CreateRoomForUserInput): Promise<Room>;
  /** Rooms the user belongs to, newest first. */
  listForUser(userId: string): Promise<Room[]>;
  get(input: RoomScopedInput): Promise<RoomSnapshot>;
  listMembers(input: RoomScopedInput): Promise<RoomMemberSummary[]>;
  queueMusic(input: QueueMusicInput): Promise<void>;
  /** Applies a playback command and announces the resulting anchor. */
  commandPlayback(input: CommandPlaybackInput): Promise<Room>;
  /**
   * Records that a listener's track finished, advancing the room to the next
   * queued one — or stopping it if the queue is spent.
   *
   * Resolves `null` when the report is stale, which is the normal case for
   * every listener but the first: the server cannot know a track's length
   * (it never sees the bytes, ADR 0038/0045), so everyone reports and the
   * room arbitrates.
   */
  reportTrackEnded(input: ReportTrackEndedInput): Promise<Room | null>;
  /**
   * A live stream of the room's events. Opening it marks the requester
   * **present**; ending it (or aborting) removes them. Presence changes are
   * announced to everyone else.
   */
  watch(input: WatchRoomInput): Promise<AsyncIterable<RoomEvent>>;
  /** The room's queued tracks, resolved. Used internally and by the router. */
  listMusics(input: RoomScopedInput): Promise<Music[]>;

  /** Posts a message to the room and announces it (ADR 0044). */
  sendMessage(input: SendMessageInput): Promise<RoomMessageSummary>;
  /** The recent history a client sees on arrival, oldest first. */
  listMessages(input: ListMessagesInput): Promise<RoomMessageSummary[]>;
  /**
   * Messages missed since `lastEventId`, then the live stream.
   *
   * The order inside matters and is the whole point of ADR 0044: subscribing
   * **before** querying the backfill is what prevents a message published in
   * between from falling through the gap, and skipping already-yielded ids is
   * what stops the resulting overlap being delivered twice.
   */
  watchMessages(
    input: WatchMessagesInput,
  ): Promise<AsyncIterable<RoomMessageSummary>>;
}
