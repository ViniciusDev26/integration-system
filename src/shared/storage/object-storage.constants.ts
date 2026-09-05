/**
 * Default lifetime of a presigned playback URL (ADR 0007). Long enough to start
 * streaming a track, short enough that a leaked URL expires quickly.
 */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour
