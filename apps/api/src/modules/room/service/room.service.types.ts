import type { Music } from "../../../shared/db/schema/musics.js";
import type { Room } from "../../../shared/db/schema/rooms.js";
import type { RoomRegistry } from "../../../shared/realtime/room-registry.js";
import type { ObjectStorage } from "../../../shared/storage/object-storage.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import type { MusicListItem } from "../../music/service/music.service.types.js";
import type {
  RoomMemberSummary,
  RoomRepository,
} from "../repository/room.repository.js";
import type { RoomEvent, RoomEventBus } from "../room.events.js";
import type { PlaybackCommand } from "../room.playback.js";

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

export interface RoomServiceOptions {
  roomRepository: RoomRepository;
  /** Used to validate a track exists before queueing it. */
  musicRepository: MusicRepository;
  /** Used to presign playback/thumbnail URLs. */
  objectStorage: ObjectStorage;
  /** Where room changes are announced (ADR 0039). */
  eventBus: RoomEventBus;
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
   * A live stream of the room's events. Opening it marks the requester
   * **present**; ending it (or aborting) removes them. Presence changes are
   * announced to everyone else.
   */
  watch(input: WatchRoomInput): Promise<AsyncIterable<RoomEvent>>;
  /** The room's queued tracks, resolved. Used internally and by the router. */
  listMusics(input: RoomScopedInput): Promise<Music[]>;
}
