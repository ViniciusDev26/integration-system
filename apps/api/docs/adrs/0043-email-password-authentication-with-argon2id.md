# 0043. Email/password authentication, hashed with argon2id

- Status: Accepted
- Date: 2026-10-02

## Context

GitHub OAuth has been the only way in (ADR 0020). That requires every user to
have a GitHub account, which is fine for a developer audience and not fine for
anyone else — and it makes the app unusable to demonstrate without one.

Email and password has to coexist with what exists, and the existing schema
makes two things non-negotiable:

- `users.github_id` is `NOT NULL UNIQUE`. A password user has no GitHub id, so
  the column **must become nullable**.
- `users.email` is `NOT NULL UNIQUE`. One address therefore cannot belong to two
  accounts, which forces a decision about the same email arriving by both
  routes rather than allowing it to be deferred.

## Decision

### argon2id, via `@node-rs/argon2`

Passwords are hashed with **argon2id** — OWASP's first recommendation — using
`@node-rs/argon2` at its defaults (`m=19456, t=2, p=1`), which are the
OWASP-recommended baseline. The library encodes the salt and parameters into the
hash string, so verification needs no separate columns.

The dependency was taken over Node's built-in `crypto.scrypt`, which would have
cost nothing. argon2id is the stronger primitive against GPU attack and is what
the current guidance names; writing the scrypt wrapper by hand would have meant
owning salt handling, parameter choice and constant-time comparison for a
security primitive.

**The musl risk was checked, not assumed.** All four Dockerfile stages are
`node:24.18.0-alpine`, and a native module that needs compiling there is exactly
the kind of build failure this repo has hit before. `@node-rs/argon2` ships
prebuilt binaries including `linux-x64-musl`, the lockfile records that variant
with `libc: ["musl"]`, and hashing and verifying were confirmed to work inside a
real `node:24.18.0-alpine` container before any code was written.

The hasher sits behind a **`PasswordHasher` port** (ADR 0027) with the argon2
adapter and an in-memory fake, so services are tested without paying argon2's
deliberate cost on every run.

### Schema

- `users.password_hash` — nullable text; `null` for an OAuth-only account.
- `users.github_id` — becomes **nullable**; `null` for a password-only account.
- A check constraint requires **at least one credential**:
  `github_id IS NOT NULL OR password_hash IS NOT NULL`. Without it the nullable
  columns would permit an account nobody can sign into.

### The same email from both routes — deliberately asymmetric

GitHub gives us only a `primary && verified` address (ADR 0020), so **GitHub
proves the email**. Registering with a password proves nothing, because this
project has no email verification. The two directions are therefore not
symmetric:

- **GitHub login finds an existing account with that verified email** → link the
  `github_id` onto that account and sign in. The address was proven.
- **Password registration finds an existing account with that email** →
  **refuse**. Allowing it would let anyone who knows an address set a password
  on somebody else's account.

### Not leaking which accounts exist

A failed login returns one error regardless of cause — unknown email, no
password set on the account, or wrong password. The service also verifies
against a dummy hash when no user is found, so a missing account does not answer
measurably faster than a wrong password.

Registration cannot hide the collision in the same way: it has to refuse. That
is an accepted, bounded disclosure, and the usual mitigations (rate limiting,
email verification) are not in place anywhere yet.

### Password rules

Minimum 8 characters, maximum 128, and **no composition rules** — following
NIST SP 800-63B, which found that forced symbol/case mixes push people toward
predictable patterns. The maximum exists so a pathological input cannot turn a
deliberately expensive hash into a denial of service.

## Consequences

- **Two credential kinds per account.** `getCurrentUser` and sessions are
  unchanged — both routes end in the same server-side session cookie (ADR 0016),
  so nothing downstream of login had to learn about this.
- **An account can gain a credential it did not start with**, when GitHub links
  onto a password account. The reverse — adding a password to an OAuth account —
  is not implemented and would need the same proof-of-address argument.
- **The check constraint is what keeps a credential-less row impossible.** Any
  future code path that nulls one column must consider the other.
- **A dependency with a native binary** is now on the critical path for signing
  in. Verified on musl, but a future base-image change has to re-verify it.
- **No email verification, no password reset, no rate limiting.** Registration
  therefore discloses whether an address is in use, and a forgotten password is
  unrecoverable. All three are real gaps, recorded rather than implied.

## Alternatives considered

- **Node's built-in `crypto.scrypt`.** Zero dependencies, works on musl with no
  binaries at all, and accepted by OWASP. Rejected in favour of the stronger
  primitive; the trade was a dependency against hand-written handling of salt,
  parameters and constant-time comparison.

- **bcrypt.** The most familiar option, but it silently truncates at 72 bytes
  and is the weakest of the three against GPU attack. Rejected.

- **Refusing the email collision in both directions.** Simpler, with no implicit
  linking at all. Rejected because it creates a dead end: someone who registered
  with a password at their GitHub address could never use GitHub login again,
  and the attempt would surface as a unique-constraint error rather than
  anything meaningful.

- **Dropping the unique constraint on email**, letting two accounts share an
  address. Rejected: it defers the decision at the cost of two accounts that
  look identical to their owner, and forecloses using email as an identity
  later.
