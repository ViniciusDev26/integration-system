# 0016. Use server-side sessions with an httpOnly cookie (not JWT)

- Status: Accepted
- Date: 2026-09-05

## Context

The first feature is GitHub social login (OAuth). After authenticating, the API
must maintain the user's authenticated state across requests. The two common
approaches are stateless JWTs sent by the client, or server-side sessions
referenced by a cookie.

## Decision

Use **server-side sessions** identified by a **session ID stored in an httpOnly
cookie**, rather than JWT tokens. The cookie holds only an opaque session
identifier; session data lives on the server.

Cookie attributes: **`HttpOnly`** (not readable by JavaScript), plus
**`Secure`** and an appropriate **`SameSite`** setting, in production.

## Consequences

- **Security:** an httpOnly cookie is not accessible to client-side JavaScript,
  mitigating token theft via XSS. `Secure` + `SameSite` further harden it.
- **Revocation:** sessions can be invalidated server-side immediately (logout,
  compromise), which stateless JWTs cannot do without extra machinery.
- **Simplicity for a browser client:** the browser sends the cookie
  automatically; no token handling in client code.
- **Requires a session store** on the server. Where sessions are persisted
  (e.g. PostgreSQL — already in the stack, ADR 0008 — vs an in-memory or Redis
  store) is a **follow-up decision** tracked in `memory.md`.
- **CSRF consideration:** cookie-based auth is susceptible to CSRF; standard
  mitigations (`SameSite`, and/or CSRF tokens for state-changing requests) must
  be applied. To be addressed when auth is implemented.
- Introduces server-side state (the trade against JWT's statelessness), which is
  acceptable for this API and enables straightforward revocation.

## Alternatives considered

- **JWT (stateless):** no server session store and easy horizontal scaling, but
  hard to revoke before expiry, and storing tokens safely on the client is
  error-prone (localStorage is XSS-exposed; cookies bring similar CSRF concerns
  anyway). Rejected in favor of revocable server sessions.
- **JWT stored in an httpOnly cookie:** keeps the cookie benefits but retains
  JWT's revocation problem; server sessions were preferred for control.
