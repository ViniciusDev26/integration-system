/**
 * Domain errors thrown by {@link PlaylistService}, mapped to HTTP status codes by
 * the controller (404/403/404 respectively). Using typed errors keeps the
 * service transport-agnostic while letting the HTTP layer distinguish cases.
 */

/** The playlist does not exist. → 404 */
export class PlaylistNotFoundError extends Error {}

/** The requester is not a member of the playlist. → 403 */
export class PlaylistForbiddenError extends Error {}

/** The music to be added does not exist. → 404 */
export class MusicNotFoundError extends Error {}
