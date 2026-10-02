/**
 * Domain errors thrown by {@link RoomService} (ADR 0041), mapped to tRPC codes
 * by the router. Typed errors keep the service transport-agnostic.
 */

/** The room does not exist. → 404 */
export class RoomNotFoundError extends Error {}

/** The requester is not a member of the room. → 403 */
export class RoomForbiddenError extends Error {}

/** The track does not exist, or is not queued in this room. → 404 */
export class RoomMusicNotFoundError extends Error {}
