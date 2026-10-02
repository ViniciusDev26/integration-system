import { describe, expect, it } from "vitest";
import { validateCommandAgainstQueue } from "./room.queue.js";

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
