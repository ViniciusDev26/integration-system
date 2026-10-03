import { describe, expect, it } from "vitest";
import type { PlaybackAnchor } from "../../../shared/db/schema/rooms.js";
import {
  anchorAfterTrackEnd,
  validateCommandAgainstQueue,
} from "./room.queue.js";

/** No fakes — the signal that this is a domain layer (ADR 0046). */
describe("validateCommandAgainstQueue", () => {
  const queue = ["music-1", "music-2"];

  it("allows selecting a track the room has queued", () => {
    expect(
      validateCommandAgainstQueue(queue, {
        type: "SELECT_TRACK",
        musicId: "music-2",
      }),
    ).toBe("ok");
  });

  it("refuses a track the room does not have", () => {
    // Otherwise a client could point the room at anything in the catalogue.
    expect(
      validateCommandAgainstQueue(queue, {
        type: "SELECT_TRACK",
        musicId: "music-elsewhere",
      }),
    ).toBe("not-queued");
  });

  it("refuses any selection when the queue is empty", () => {
    expect(
      validateCommandAgainstQueue([], {
        type: "SELECT_TRACK",
        musicId: "music-1",
      }),
    ).toBe("not-queued");
  });

  it("allows transport commands, which name no track", () => {
    // Play, pause and seek act on whatever the room is already on.
    expect(validateCommandAgainstQueue([], { type: "PLAY" })).toBe("ok");
    expect(validateCommandAgainstQueue([], { type: "PAUSE" })).toBe("ok");
    expect(
      validateCommandAgainstQueue([], { type: "SEEK", positionMs: 1000 }),
    ).toBe("ok");
  });
});

/** No fakes here either — the whole rule is a function of its arguments. */
describe("anchorAfterTrackEnd", () => {
  const queue = ["music-1", "music-2", "music-3"];
  const NOW = new Date("2026-10-03T12:00:00.000Z");
  const EARLIER = new Date("2026-10-03T11:55:00.000Z");

  const playing = (musicId: string): PlaybackAnchor => ({
    currentMusicId: musicId,
    positionMs: 1_000,
    isPlaying: true,
    playbackUpdatedAt: EARLIER,
  });

  it("advances to the next queued track, from its start", () => {
    const outcome = anchorAfterTrackEnd(
      playing("music-1"),
      queue,
      "music-1",
      NOW,
    );

    expect(outcome).toEqual({
      type: "advanced",
      anchor: {
        currentMusicId: "music-2",
        positionMs: 0,
        isPlaying: true,
        playbackUpdatedAt: NOW,
      },
    });
  });

  it("stops at the end of the queue rather than wrapping", () => {
    // A room has no repeat mode; finishing the queue means the room is done.
    const outcome = anchorAfterTrackEnd(
      playing("music-3"),
      queue,
      "music-3",
      NOW,
    );

    expect(outcome).toEqual({
      type: "finished",
      anchor: {
        currentMusicId: "music-3",
        positionMs: 0,
        isPlaying: false,
        playbackUpdatedAt: NOW,
      },
    });
  });

  it("ignores a report for a track the room has already left", () => {
    // Every listener reports the end at roughly the same moment. The first one
    // moves the room; the rest arrive against a track that is no longer current
    // and must not advance it a second time.
    expect(
      anchorAfterTrackEnd(playing("music-2"), queue, "music-1", NOW),
    ).toEqual({ type: "stale" });
  });

  it("ignores a report when the room is paused", () => {
    // A paused track cannot have ended, so this is a stale or bogus report.
    const paused: PlaybackAnchor = { ...playing("music-1"), isPlaying: false };

    expect(anchorAfterTrackEnd(paused, queue, "music-1", NOW)).toEqual({
      type: "stale",
    });
  });

  it("ignores a report when the room is on no track at all", () => {
    const idle: PlaybackAnchor = {
      currentMusicId: null,
      positionMs: 0,
      isPlaying: false,
      playbackUpdatedAt: EARLIER,
    };

    expect(anchorAfterTrackEnd(idle, queue, "music-1", NOW)).toEqual({
      type: "stale",
    });
  });

  it("ignores a report for a track that is not in the queue", () => {
    expect(
      anchorAfterTrackEnd(playing("music-1"), ["music-2"], "music-1", NOW),
    ).toEqual({ type: "stale" });
  });
});
