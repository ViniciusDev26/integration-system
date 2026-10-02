import { describe, expect, it } from "vitest";
import { expiresAtFrom, hasExpired } from "./expiry.js";

/** No fakes — a domain layer (ADR 0046). */
const T0 = new Date("2026-10-02T12:00:00.000Z");
const at = (ms: number) => new Date(T0.getTime() + ms);

describe("expiresAtFrom", () => {
  it("adds the lifetime to the issuing instant", () => {
    expect(expiresAtFrom(T0, 60_000)).toEqual(at(60_000));
  });

  it("gives something already expired for a zero lifetime", () => {
    expect(hasExpired(expiresAtFrom(T0, 0), T0)).toBe(true);
  });
});

describe("hasExpired", () => {
  it("is false before the instant", () => {
    expect(hasExpired(at(1), T0)).toBe(false);
  });

  it("is true at the instant itself", () => {
    // The closed boundary is the point: callers must not each guess.
    expect(hasExpired(T0, T0)).toBe(true);
  });

  it("is true after the instant", () => {
    expect(hasExpired(T0, at(1))).toBe(true);
  });
});
