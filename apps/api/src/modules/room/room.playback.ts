import type { PlaybackAnchor } from "../../shared/db/schema/rooms.js";

/**
 * What someone asked the room's playback to do. Deliberately coarse — these are
 * the only four things that move the anchor (ADR 0041).
 */
export type PlaybackCommand =
  | { type: "PLAY" }
  | { type: "PAUSE" }
  | { type: "SEEK"; positionMs: number }
  | { type: "SELECT_TRACK"; musicId: string };

/**
 * Where the room actually is, right now, derived from the anchor.
 *
 * This is the whole reason the server does not tick: while playing, the
 * position is the anchored one plus the time since it was set. Paused, the
 * anchor *is* the position.
 */
export function livePositionMs(anchor: PlaybackAnchor, now: Date): number {
  if (!anchor.isPlaying) {
    return anchor.positionMs;
  }
  const elapsed = now.getTime() - anchor.playbackUpdatedAt.getTime();
  // A clock that went backwards must not rewind the room.
  return anchor.positionMs + Math.max(0, elapsed);
}

/**
 * The anchor a command produces. Pure, so every rule here is testable without a
 * database or a clock.
 *
 * Re-anchoring on every command is what keeps listeners together: each one
 * resets the instant everyone extrapolates from.
 */
export function applyPlaybackCommand(
  anchor: PlaybackAnchor,
  command: PlaybackCommand,
  now: Date,
): PlaybackAnchor {
  switch (command.type) {
    case "PLAY":
      // Resuming continues from where it was paused; already-playing re-anchors
      // to the live position so it does not jump.
      return {
        ...anchor,
        positionMs: livePositionMs(anchor, now),
        isPlaying: true,
        playbackUpdatedAt: now,
      };

    case "PAUSE":
      return {
        ...anchor,
        positionMs: livePositionMs(anchor, now),
        isPlaying: false,
        playbackUpdatedAt: now,
      };

    case "SEEK":
      // Seeking does not change whether the room is playing.
      return {
        ...anchor,
        positionMs: Math.max(0, command.positionMs),
        playbackUpdatedAt: now,
      };

    case "SELECT_TRACK":
      // A new track always starts from the beginning, and starts playing —
      // picking a track in a listening room means "play this now".
      return {
        currentMusicId: command.musicId,
        positionMs: 0,
        isPlaying: true,
        playbackUpdatedAt: now,
      };
  }
}
