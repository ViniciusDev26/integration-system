# 0020. Implement GitHub OAuth manually (fetch + Zod), no auth library

- Status: Accepted
- Date: 2026-09-05

## Context

The first feature is GitHub social login (OAuth), with our own session handling
(ADR 0016, sessions in PostgreSQL per ADR 0019). We evaluated auth libraries:

- **Arctic** (the modern, typed, ESM option we initially favored) was
  **deprecated in July 2026**, along with the broader Lucia/Oslo ecosystem from
  the same author, who now recommends copying the code rather than depending on
  the library.
- **Passport (passport-github2):** callback-style, weak third-party types, pulls
  in `express-session` — friction with our 100% type-safety (ADR 0009) and our
  own session store (ADR 0016).
- **Auth.js / better-auth:** batteries-included, but take over session and auth
  models, conflicting with ADR 0016 and the Repository pattern, and adding
  abstraction that works against the goal of learning DDD with full control.
- **openid-client (panva):** robust and maintained, but OIDC-leaning and heavier
  than GitHub's simple OAuth2 authorization-code flow needs.

## Decision

Implement the GitHub **authorization-code flow manually** using `fetch`, with
**Zod validating every GitHub response** (ADR 0011). No OAuth library.

- `GET /auth/github` → generate a random `state`, store it (CSRF protection),
  redirect to GitHub's authorize URL.
- `GET /auth/github/callback` → verify `state`, exchange `code` for an access
  token (`POST /login/oauth/access_token`), fetch the user (`GET /user`), each
  response parsed with a Zod schema.
- Upsert the user, create a session in PostgreSQL (ADR 0019), set the httpOnly
  session cookie (ADR 0016).
- Client id/secret and callback URL come from Zod-validated env
  (`shared/env.ts`, ADR 0009/0011).

All of this lives in the `auth` module (`src/modules/auth/`, ADR 0018).

## Consequences

- **Zero auth dependency, full control and type-safety**, ESM-native, no
  lock-in — and immune to the library churn that just killed Arctic.
- We own `state`/CSRF handling, token-exchange correctness, and error edge cases
  — a small, well-scoped amount of code for GitHub's simple flow.
- Good fit for the future DDD migration: no framework owns our auth/domain.
- GitHub OAuth for a confidential (server) client uses the client secret;
  `state` provides CSRF protection. PKCE can be added later if desired.

## Alternatives considered

See Context — Arctic (deprecated), Passport, Auth.js/better-auth, openid-client.
Manual was chosen as the most aligned with ADR 0009/0011/0016/0018 and the most
durable given the instability of the lightweight-OAuth-library space.
