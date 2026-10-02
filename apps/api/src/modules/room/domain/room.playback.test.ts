import { describe, expect, it } from "vitest";
import type { PlaybackAnchor } from "../../../shared/db/schema/rooms.js";
import { applyPlaybackCommand, livePositionMs } from "./room.playback.js";

const T0 = new Date("2026-10-02T12:00:00.000Z");
const at = (msAfterT0: number) => new Date(T0.getTime() + msAfterT0);

function anchor(overrides: Partial<PlaybackAnchor> = {}): PlaybackAnchor {
  return {
    currentMusicId: "music-1",
    positionMs: 0,
    isPlaying: false,
    playbackUpdatedAt: T0,
    ...overrides,
  };
}

describe("livePositionMs", () => {
  it("is the anchored position while paused, however much time passes", () => {
    const paused = anchor({ positionMs: 30_000, isPlaying: false });

    expect(livePositionMs(paused, at(60_000))).toBe(30_000);
  });

  it("advances with elapsed time while playing", () => {
    const playing = anchor({ positionMs: 30_000, isPlaying: true });

    expect(livePositionMs(playing, at(5_000))).toBe(35_000);
  });

  it("is exactly the anchor at the instant it was set", () => {
    const playing = anchor({ positionMs: 30_000, isPlaying: true });

    expect(livePositionMs(playing, T0)).toBe(30_000);
  });

  it("never rewinds if the clock goes backwards", () => {
    const playing = anchor({ positionMs: 30_000, isPlaying: true });

    expect(livePositionMs(playing, at(-5_000))).toBe(30_000);
  });
});

describe("applyPlaybackCommand", () => {
  describe("PLAY", () => {
    it("resumes from where it was paused", () => {
      const paused = anchor({ positionMs: 30_000, isPlaying: false });

      const next = applyPlaybackCommand(paused, { type: "PLAY" }, at(60_000));

      expect(next).toEqual({
        currentMusicId: "music-1",
        positionMs: 30_000,
        isPlaying: true,
        playbackUpdatedAt: at(60_000),
      });
    });

    it("re-anchors an already-playing room without jumping", () => {
      const playing = anchor({ positionMs: 10_000, isPlaying: true });

      const next = applyPlaybackCommand(playing, { type: "PLAY" }, at(5_000));

      expect(next.positionMs).toBe(15_000);
      expect(livePositionMs(next, at(5_000))).toBe(15_000);
    });
  });

  describe("PAUSE", () => {
    it("freezes at the live position", () => {
      const playing = anchor({ positionMs: 10_000, isPlaying: true });

      const next = applyPlaybackCommand(playing, { type: "PAUSE" }, at(7_000));

      expect(next.positionMs).toBe(17_000);
      expect(next.isPlaying).toBe(false);
      expect(livePositionMs(next, at(999_000))).toBe(17_000);
    });

    it("pausing twice does not move the position", () => {
      const playing = anchor({ positionMs: 10_000, isPlaying: true });

      const once = applyPlaybackCommand(playing, { type: "PAUSE" }, at(7_000));
      const twice = applyPlaybackCommand(once, { type: "PAUSE" }, at(99_000));

      expect(twice.positionMs).toBe(17_000);
    });
  });

  describe("SEEK", () => {
    it("moves the position and keeps playing", () => {
      const playing = anchor({ positionMs: 10_000, isPlaying: true });

      const next = applyPlaybackCommand(
        playing,
        { type: "SEEK", positionMs: 90_000 },
        at(3_000),
      );

      expect(next.positionMs).toBe(90_000);
      expect(next.isPlaying).toBe(true);
      expect(next.playbackUpdatedAt).toEqual(at(3_000));
    });

    it("keeps a paused room paused", () => {
      const paused = anchor({ positionMs: 10_000, isPlaying: false });

      const next = applyPlaybackCommand(
        paused,
        { type: "SEEK", positionMs: 5_000 },
        at(3_000),
      );

      expect(next.isPlaying).toBe(false);
      expect(livePositionMs(next, at(99_000))).toBe(5_000);
    });

    it("clamps a negative target to the start", () => {
      const next = applyPlaybackCommand(
        anchor(),
        { type: "SEEK", positionMs: -1 },
        T0,
      );

      expect(next.positionMs).toBe(0);
    });
  });

  describe("SELECT_TRACK", () => {
    it("starts the new track from the beginning, playing", () => {
      const playing = anchor({ positionMs: 120_000, isPlaying: true });

      const next = applyPlaybackCommand(
        playing,
        { type: "SELECT_TRACK", musicId: "music-2" },
        at(4_000),
      );

      expect(next).toEqual({
        currentMusicId: "music-2",
        positionMs: 0,
        isPlaying: true,
        playbackUpdatedAt: at(4_000),
      });
    });

    it("starts playing even from a paused room", () => {
      const paused = anchor({ isPlaying: false });

      const next = applyPlaybackCommand(
        paused,
        { type: "SELECT_TRACK", musicId: "music-2" },
        at(1_000),
      );

      expect(next.isPlaying).toBe(true);
    });
  });

  it("keeps two listeners agreeing on the position after a command", () => {
    // What synchronization actually means: the same anchor read at the same
    // instant yields the same position, whoever is doing the reading.
    const started = applyPlaybackCommand(
      anchor(),
      { type: "SELECT_TRACK", musicId: "music-2" },
      T0,
    );

    const listenerA = livePositionMs(started, at(12_345));
    const listenerB = livePositionMs(started, at(12_345));

    expect(listenerA).toBe(12_345);
    expect(listenerB).toBe(listenerA);
  });
});
