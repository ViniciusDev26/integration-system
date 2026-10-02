import type { PlaybackCommand } from "./room.playback.js";

/**
 * Rules about a room's queue (ADR 0046 domain layer).
 *
 * Pure: given the ids a room has queued, these decide whether a command is
 * allowed. Fetching that queue is the application layer's job.
 */

/** Whether a playback command may be applied, and if not, why. */
export type CommandValidity = "ok" | "not-queued";

/**
 * A room plays from **its own** queue. Without this, a client could point the
 * room at anything in the catalogue by id.
 *
 * Only `SELECT_TRACK` names a track; play, pause and seek act on whatever the
 * room is already on, so they are always allowed here.
 */
export function validateCommandAgainstQueue(
  queuedMusicIds: readonly string[],
  command: PlaybackCommand,
): CommandValidity {
  if (command.type !== "SELECT_TRACK") {
    return "ok";
  }
  return queuedMusicIds.includes(command.musicId) ? "ok" : "not-queued";
}
