/**
 * Port for password hashing (ADR 0043, ADR 0027).
 *
 * Kept behind a port for two reasons: the algorithm is a security decision that
 * should be replaceable without touching the service, and argon2 is
 * *deliberately* slow — unit tests use a fake rather than paying that cost on
 * every run.
 *
 * Implementations must encode the salt and parameters inside the returned
 * string, so verification needs nothing stored alongside it.
 */
export interface PasswordHasher {
  /** Derives a storable hash. Never returns the password. */
  hash(plain: string): Promise<string>;
  /**
   * Whether `plain` matches `hash`. Must not throw on a malformed hash — a
   * corrupted row is a failed login, not a crash.
   */
  verify(hash: string, plain: string): Promise<boolean>;
}
