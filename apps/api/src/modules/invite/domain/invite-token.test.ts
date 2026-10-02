import { describe, expect, it } from "vitest";
import {
  INVITE_TOKEN_BYTES,
  InvalidInviteTokenError,
  inviteTokenFrom,
  isInviteToken,
} from "./invite-token.js";

/** No fakes — a domain layer (ADR 0046/0047). */

/** What `randomBytes(32).toString("base64url")` actually looks like. */
const REAL = "Zm9vYmFyYmF6cXV4Zm9vYmFyYmF6cXV4Zm9vYmFyYmE";

describe("inviteTokenFrom", () => {
  it("accepts a token the generator could have produced", () => {
    expect(inviteTokenFrom(REAL)).toBe(REAL);
  });

  it("accepts the full base64url alphabet", () => {
    const withSymbols = `${"-_".repeat(10)}${"A".repeat(23)}`;

    expect(() => inviteTokenFrom(withSymbols)).not.toThrow();
  });

  it("refuses anything too short to carry the entropy", () => {
    // 32 bytes is 43 base64url characters; a room id is not a token.
    expect(() => inviteTokenFrom("tok-1")).toThrow(InvalidInviteTokenError);
    expect(() => inviteTokenFrom("")).toThrow(InvalidInviteTokenError);
    expect(() => inviteTokenFrom("a".repeat(42))).toThrow(
      InvalidInviteTokenError,
    );
  });

  it("refuses characters base64url never produces", () => {
    // `+`, `/` and `=` belong to plain base64, not base64url.
    expect(() => inviteTokenFrom(`${"a".repeat(42)}+`)).toThrow(
      InvalidInviteTokenError,
    );
    expect(() => inviteTokenFrom(`${"a".repeat(42)}=`)).toThrow(
      InvalidInviteTokenError,
    );
  });

  it("derives its minimum from the configured entropy", () => {
    const exact = "a".repeat(Math.ceil((INVITE_TOKEN_BYTES * 4) / 3));

    expect(() => inviteTokenFrom(exact)).not.toThrow();
  });
});

describe("isInviteToken", () => {
  it("answers without throwing, for transport-level checks", () => {
    expect(isInviteToken(REAL)).toBe(true);
    expect(isInviteToken("tok-1")).toBe(false);
  });
});
