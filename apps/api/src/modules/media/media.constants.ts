/** Where media is served from, on our own origin (ADR 0045). */
export const MEDIA_ENDPOINT = "/media";

/**
 * Lifetime of the signed URL a redirect points at (ADR 0045). It only has to
 * outlive the redirect itself, so it is far shorter than the hour that applied
 * when the client held the URL (ADR 0007).
 */
export const REDIRECT_SIGNED_URL_TTL_SECONDS = 5 * 60;

/** The path the client is given for a track's audio. Never expires. */
export function mediaPlaybackPath(musicId: string): string {
  return `${MEDIA_ENDPOINT}/musics/${musicId}`;
}

/** The path the client is given for a track's cover. Never expires. */
export function mediaCoverPath(musicId: string): string {
  return `${MEDIA_ENDPOINT}/musics/${musicId}/cover`;
}
