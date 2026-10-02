import { describe, expect, it } from "vitest";
import type { Invite } from "./invite.js";
import {
  expiresAtFrom,
  isRedeemable,
  redeemabilityOf,
  revocationFor,
} from "./invite.js";
import { inviteTokenFrom } from "./invite-token.js";

/**
 * No fakes, no container, no clock injection — the signal that this is a domain
 * layer (ADR 0046). Every test here constructs a value and calls a function.
 */

const T0 = new Date("2026-10-02T12:00:00.000Z");
const at = (msAfterT0: number) => new Date(T0.getTime() + msAfterT0);

/**
 * The rules only read two fields, but the entity is the entity — constructing a
 * whole one is the cost of the model no longer being a loose bag of fields
 * (ADR 0047).
 */
function inviteWith(overrides: Partial<Invite>): Invite {
  return {
    id: "invite-1",
    createdAt: T0,
    token: inviteTokenFrom("a".repeat(43)),
    resource: { resourceType: "PLAYLIST", resourceId: "playlist-1" },
    createdBy: "user-1",
    expiresAt: at(60_000),
    revokedAt: null,
    ...overrides,
  };
}

describe("redeemabilityOf", () => {
  it("is redeemable before expiry and un-revoked", () => {
    const invite = inviteWith({ revokedAt: null, expiresAt: at(60_000) });

    expect(redeemabilityOf(invite, T0)).toBe("redeemable");
    expect(isRedeemable(invite, T0)).toBe(true);
  });

  it("is expired once the instant passes", () => {
    const invite = inviteWith({ revokedAt: null, expiresAt: at(60_000) });

    expect(redeemabilityOf(invite, at(60_001))).toBe("expired");
  });

  it("treats the expiry instant itself as expired", () => {
    const invite = inviteWith({ revokedAt: null, expiresAt: at(60_000) });

    expect(redeemabilityOf(invite, at(60_000))).toBe("expired");
  });

  it("is revoked once revoked, however much time is left", () => {
    const invite = inviteWith({ revokedAt: T0, expiresAt: at(99_999_999) });

    expect(redeemabilityOf(invite, T0)).toBe("revoked");
    expect(isRedeemable(invite, T0)).toBe(false);
  });

  it("reports revoked rather than expired when it is both", () => {
    const invite = inviteWith({ revokedAt: T0, expiresAt: at(1_000) });

    // The deliberate act is the more useful thing to say.
    expect(redeemabilityOf(invite, at(5_000))).toBe("revoked");
  });
});

describe("expiresAtFrom", () => {
  it("adds the lifetime to the issuing instant", () => {
    expect(expiresAtFrom(T0, 60_000)).toEqual(at(60_000));
  });

  it("produces an already-expired invite for a zero lifetime", () => {
    const expiresAt = expiresAtFrom(T0, 0);

    expect(redeemabilityOf(inviteWith({ expiresAt }), T0)).toBe("expired");
  });
});

describe("revocationFor", () => {
  it("records the moment when the invite is still live", () => {
    expect(
      revocationFor(inviteWith({ revokedAt: null, expiresAt: at(1) }), T0),
    ).toEqual(T0);
  });

  it("has nothing to do when already revoked", () => {
    const already = inviteWith({ revokedAt: T0, expiresAt: at(1) });

    expect(revocationFor(already, at(99_000))).toBeNull();
  });

  it("revokes an expired invite, which is still a meaningful act", () => {
    // Expiry stops it working; revoking records that someone withdrew it.
    const expired = inviteWith({ revokedAt: null, expiresAt: at(-1) });

    expect(revocationFor(expired, T0)).toEqual(T0);
  });
});
