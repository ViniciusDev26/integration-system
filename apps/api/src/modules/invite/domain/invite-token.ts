/**
 * An invite's bearer token (ADR 0047 value object).
 *
 * The brand is **type-level only** — at runtime this is a string, so it crosses
 * Drizzle and tRPC unchanged. What it buys is that a room id, a user id or an
 * empty string can no longer be passed where a token is expected.
 */
export type InviteToken = string & { readonly __brand: "InviteToken" };

/**
 * How much entropy a token carries. A property of the token itself, so it lives
 * here rather than in the service that happens to generate one.
 */
export const INVITE_TOKEN_BYTES = 32;

/** base64url of N bytes is ceil(N * 4 / 3) characters, unpadded. */
const MINIMUM_LENGTH = Math.ceil((INVITE_TOKEN_BYTES * 4) / 3);

/** The alphabet `base64url` produces — no `+`, `/` or `=`. */
const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** A string that could not have come from a token generator. */
export class InvalidInviteTokenError extends Error {}

/**
 * The only way to make an {@link InviteToken}.
 *
 * Throws rather than returning an outcome: a rule answering "no" is normal, but
 * a malformed token means a corrupt row or a transport that failed to validate
 * (ADR 0047).
 *
 * The single `as` here is where the brand is minted. It widens nothing — the
 * runtime type is unchanged — and it is the one place the invariant is
 * established, which is why it is not the laundering cast ADR 0009 bans.
 */
export function inviteTokenFrom(raw: string): InviteToken {
  if (raw.length < MINIMUM_LENGTH || !BASE64URL.test(raw)) {
    throw new InvalidInviteTokenError(
      `not a valid invite token (${raw.length} chars)`,
    );
  }
  return raw as InviteToken;
}

/** Whether a string could be a token, without throwing — for transport input. */
export function isInviteToken(raw: string): boolean {
  return raw.length >= MINIMUM_LENGTH && BASE64URL.test(raw);
}
