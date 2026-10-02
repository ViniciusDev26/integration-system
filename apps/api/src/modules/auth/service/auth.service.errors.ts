/**
 * Domain errors thrown by {@link AuthService} (ADR 0043), mapped to tRPC codes
 * by the router.
 */

/**
 * The email or the password did not check out. Deliberately **one** error for
 * every cause — unknown address, account with no password set, wrong password —
 * so a failed login does not reveal which accounts exist. → 401
 */
export class InvalidCredentialsError extends Error {}

/**
 * Registration hit an address that already has an account. This one *does*
 * disclose existence, because registration cannot do otherwise; see ADR 0043.
 * → 409
 */
export class EmailAlreadyRegisteredError extends Error {}
