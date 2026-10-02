/**
 * Default lifetime of an invite link: 7 days. Long enough to share and act on,
 * short enough that a leaked link stops working on its own (ADR 0040).
 */
export const DEFAULT_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Invite token size in bytes (256 bits), matching session ids (ADR 0016). */
export const INVITE_TOKEN_BYTES = 32;
