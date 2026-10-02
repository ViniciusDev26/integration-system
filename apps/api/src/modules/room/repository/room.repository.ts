import type { Music } from "../../../shared/db/schema/musics.js";
import type { RoomMemberType } from "../../../shared/db/schema/room-members.js";
import type { PlaybackAnchor, Room } from "../../../shared/db/schema/rooms.js";

/** Data to create a room. The creator becomes its `OWNER`. */
export interface CreateRoomInput {
  name: string;
  /** `users.id` of the creator — inserted as the OWNER membership row. */
  ownerId: string;
}

export interface AddRoomMemberInput {
  roomId: string;
  userId: string;
  type: RoomMemberType;
}

export interface AddRoomMusicInput {
  roomId: string;
  musicId: string;
}

/** A member of a room, as shown to the others. */
export interface RoomMemberSummary {
  userId: string;
  type: RoomMemberType;
  name: string | null;
  imageUrl: string | null;
}

/** The anchor fields a playback command writes. */
export type SetPlaybackInput = PlaybackAnchor;

/**
 * Port for room persistence (ADR 0041, ADR 0014/0027). Mirrors
 * `PlaylistRepository` — a room owns its membership and its track associations
 * — and adds the playback anchor.
 *
 * Adapters: `createPostgresRoomRepository` (production) and an in-memory fake
 * (tests).
 */
export interface RoomRepository {
  /** Creates the room and its OWNER membership atomically. */
  create(input: CreateRoomInput): Promise<Room>;
  findById(id: string): Promise<Room | null>;
  /** Rooms the user belongs to in any role, newest first. */
  listForMember(userId: string): Promise<Room[]>;
  /** The user's role in the room, or `null` if they are not a member. */
  getMemberType(roomId: string, userId: string): Promise<RoomMemberType | null>;
  /**
   * Adds a membership row. Resolves `true` only when a row was inserted, so a
   * repeated invite redeem is distinguishable from a real join and an OWNER is
   * never demoted.
   */
  addMember(input: AddRoomMemberInput): Promise<boolean>;
  /** Everyone in the room with their role, in join order. */
  listMembers(roomId: string): Promise<RoomMemberSummary[]>;
  /** Queues a track; a no-op if it is already there. */
  addMusic(input: AddRoomMusicInput): Promise<void>;
  /** The room's tracks, in the order they were added. */
  listMusics(roomId: string): Promise<Music[]>;
  /**
   * Writes the playback anchor and returns the updated room. Called only when
   * someone plays, pauses, seeks or changes track — never on a timer.
   */
  setPlayback(roomId: string, anchor: SetPlaybackInput): Promise<Room | null>;
}
