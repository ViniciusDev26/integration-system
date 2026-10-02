/**
 * Default lifetime of an invite link: 7 days. Long enough to share and act on,
 * short enough that a leaked link stops working on its own (ADR 0040).
 */
export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// INVITE_TOKEN_BYTES moved to ../domain/invite-token.ts — the size is a property
// of the token, not of the service that happens to generate one (ADR 0047).
