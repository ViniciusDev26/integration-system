import type { PasswordHasher } from "./password-hasher.js";

/** Marks a fake hash, so a real argon2 string is never mistaken for one. */
const FAKE_PREFIX = "fake-hash:";

/**
 * In-memory {@link PasswordHasher} for unit tests (ADR 0027). Reversible and
 * instant — argon2 is deliberately expensive, and paying that in every service
 * test buys nothing, since the real adapter has its own tests.
 */
export function createFakePasswordHasher(): PasswordHasher {
  return {
    async hash(plain) {
      return `${FAKE_PREFIX}${plain}`;
    },

    async verify(stored, plain) {
      return stored === `${FAKE_PREFIX}${plain}`;
    },
  };
}
