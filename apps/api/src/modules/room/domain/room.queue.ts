import type { PlaybackAnchor } from "../../../shared/db/schema/rooms.js";
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

/** What a report that a track finished should do to the anchor. */
export type TrackEndOutcome =
  | { type: "advanced"; anchor: PlaybackAnchor }
  /** The queue ran out; the room stops rather than wrapping. */
  | { type: "finished"; anchor: PlaybackAnchor }
  /** The report does not describe where the room is; do nothing. */
  | { type: "stale" };

/**
 * Where a room goes when the track it is on finishes.
 *
 * The server cannot know this by itself: it never ticks, and it does not store
 * track durations — the bytes go browser↔R2 and never pass through it
 * (ADR 0038/0045). So **the listeners report it**, and every one of them
 * reports at roughly the same moment.
 *
 * `endedMusicId` is what makes that safe. Only a report naming the track the
 * room is actually on can move it, so the first report advances the room and
 * every later one is `stale`. The rule is the same one the repository enforces
 * again on the row, so a race that slips between the read and the write is
 * caught there too.
 */
export function anchorAfterTrackEnd(
  anchor: PlaybackAnchor,
  queuedMusicIds: readonly string[],
  endedMusicId: string,
  now: Date,
): TrackEndOutcome {
  // A paused track cannot have ended, and a room on nothing has nothing to
  // advance: either way the report describes a room that no longer exists.
  if (!anchor.isPlaying || anchor.currentMusicId !== endedMusicId) {
    return { type: "stale" };
  }

  const at = queuedMusicIds.indexOf(endedMusicId);
  if (at < 0) {
    return { type: "stale" };
  }

  const next = queuedMusicIds[at + 1];
  if (next === undefined) {
    return {
      type: "finished",
      anchor: {
        currentMusicId: endedMusicId,
        positionMs: 0,
        isPlaying: false,
        playbackUpdatedAt: now,
      },
    };
  }

  return {
    type: "advanced",
    anchor: {
      currentMusicId: next,
      positionMs: 0,
      isPlaying: true,
      playbackUpdatedAt: now,
    },
  };
}
