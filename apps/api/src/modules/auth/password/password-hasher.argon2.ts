import { Algorithm, hash, verify } from "@node-rs/argon2";
import type { PasswordHasher } from "./password-hasher.js";

/**
 * argon2id adapter for {@link PasswordHasher} (ADR 0043).
 *
 * Uses the library's defaults (`m=19456, t=2, p=1`), which are OWASP's
 * recommended argon2id baseline. The salt and those parameters are encoded in
 * the returned string, so a future parameter change still verifies old hashes.
 *
 * Prebuilt binaries cover `linux-x64-musl`, which is what the Alpine image
 * needs — confirmed in a real container before adopting this (ADR 0043).
 */
export function createArgon2PasswordHasher(): PasswordHasher {
  return {
    async hash(plain) {
      return hash(plain, { algorithm: Algorithm.Argon2id });
    },

    async verify(stored, plain) {
      try {
        return await verify(stored, plain);
      } catch {
        // A hash that argon2 cannot parse means this login fails, not that the
        // request blows up.
        return false;
      }
    },
  };
}
