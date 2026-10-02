/**
 * Domain errors thrown by the invite service (ADR 0040), mapped to tRPC codes by
 * the router. Typed errors keep the service transport-agnostic while letting the
 * transport distinguish cases.
 */

/** No invite bears this token. → 404 */
export class InviteNotFoundError extends Error {}

/** The invite exists but is past its expiry. → 410 */
export class InviteExpiredError extends Error {}

/** The invite was revoked by whoever created it. → 410 */
export class InviteRevokedError extends Error {}

/** The requester may not invite to, or manage invites of, this resource. → 403 */
export class InviteForbiddenError extends Error {}

/** The invited-to resource no longer exists. → 404 */
export class InviteResourceNotFoundError extends Error {}
