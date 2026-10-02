/**
 * Releases one membership acquired by {@link RoomRegistry.join}. Idempotent, so
 * a resolver can call it from `finally` without tracking whether it already ran.
 */
export type LeaveRoom = () => void;

/**
 * Port for room presence (ADR 0039) — who is currently in a room.
 *
 * This is the piece Socket.IO's rooms primitive would have provided, and which
 * ADR 0039 deliberately accepted building. Fan-out itself is not here: that is
 * the `EventBus`, addressed by a `room:<id>` topic. This registry answers *who
 * is present*, which fan-out alone cannot.
 *
 * Membership is **reference-counted per user**: one person with three tabs is
 * one member who stays present until the last tab goes. Callers therefore join
 * per connection, not per user.
 */
export interface RoomRegistry {
  /** Registers one connection for `userId` in `roomId`; returns its release. */
  join(roomId: string, userId: string): LeaveRoom;
  /** Distinct user ids currently present, in the order they first joined. */
  members(roomId: string): readonly string[];
  /** Whether `userId` has at least one live connection in `roomId`. */
  isMember(roomId: string, userId: string): boolean;
}
