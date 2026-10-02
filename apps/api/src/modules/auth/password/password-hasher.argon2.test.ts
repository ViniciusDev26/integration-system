import { describe, expect, it } from "vitest";
import { createArgon2PasswordHasher } from "./password-hasher.argon2.js";

/**
 * Exercises the real argon2 binary — slow by design, so it stays to the
 * properties that matter. Services use the fake instead.
 */
describe("createArgon2PasswordHasher", () => {
  const hasher = createArgon2PasswordHasher();

  it("produces an argon2id hash that is not the password", async () => {
    const stored = await hasher.hash("correct horse battery staple");

    expect(stored).toMatch(/^\$argon2id\$/);
    expect(stored).not.toContain("correct horse");
  });

  it("verifies the right password and rejects the wrong one", async () => {
    const stored = await hasher.hash("s3cret-password");

    expect(await hasher.verify(stored, "s3cret-password")).toBe(true);
    expect(await hasher.verify(stored, "s3cret-passwore")).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const first = await hasher.hash("same-password");
    const second = await hasher.hash("same-password");

    expect(first).not.toBe(second);
    expect(await hasher.verify(second, "same-password")).toBe(true);
  });

  it("returns false for a malformed hash instead of throwing", async () => {
    await expect(hasher.verify("not-a-hash", "anything")).resolves.toBe(false);
    await expect(hasher.verify("", "anything")).resolves.toBe(false);
  });

  it("handles a long password without truncating it", async () => {
    // bcrypt would silently ignore everything past 72 bytes; argon2 must not.
    const long = "a".repeat(100);
    const stored = await hasher.hash(`${long}-tail`);

    expect(await hasher.verify(stored, `${long}-tail`)).toBe(true);
    expect(await hasher.verify(stored, `${long}-TAIL`)).toBe(false);
  });
});
