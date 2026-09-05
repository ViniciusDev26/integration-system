# Tasks

Actionable task tracker. High-level state and rationale live in
[`memory.md`](./memory.md); decisions live in [`docs/adrs/`](./docs/adrs/).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done.

---

## Done

- [x] AI-first docs foundation (`AGENTS.md`, `memory.md`, `docs/`).
- [x] Stack + tooling: Node 24, TypeScript (strict), Express, npm, Biome, Vitest,
      ESM, `tsc` build, Docker Compose (PG18), Dockerfile, TDD, ports/adapters.
- [x] DB: `users` + `sessions` schema, migration, Drizzle + postgres.js, UUIDv7.
- [x] `UserRepository` (port + postgres adapter) — integration-tested.
- [x] `SessionRepository` (port + postgres adapter) — integration-tested.
- [x] `SessionService` — unit-tested.
- [x] `GitHubOAuthClient` (port + axios adapter) — unit-tested.
- [x] `AuthService` — unit-tested.

---

## Next: wire up the login so it runs end to end

No new business logic — just composition and the HTTP layer.

- [ ] **Prod DB client** — `src/shared/db/index.ts`: postgres.js + Drizzle
      client from `env.DATABASE_URL` (lazy connect).
- [ ] **Env schema** — add `DATABASE_URL`, `PUBLIC_BASE_URL`,
      `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` to `src/shared/env.ts` (Zod).
- [ ] **Composition root** — `src/container.ts`: build `db → repos → services →
      authService`, injecting production adapters (ADR 0027).
- [ ] **Auth routes/controller** — `src/modules/auth/`:
  - [ ] `GET /auth/github` → redirect to `authService.getLoginUrl()`, set the
        `state` in a short-lived httpOnly cookie.
  - [ ] `GET /auth/github/callback` → read `code` + `state` (query, validated via
        `express-zod-safe`, ADR 0012) and the expected `state` (cookie) →
        `authService.handleCallback` → set the session id in an httpOnly cookie
        (ADR 0016) → redirect.
  - [ ] `POST /auth/logout` → revoke session + clear cookie (optional now).
- [ ] **Mount** the auth routes in `src/app.ts` (+ cookie parsing).
- [ ] **Verify** the flow runs for real against a live Postgres + a real GitHub
      OAuth App (`/verify`); document the manual run.

### Follow-ups (auth)

- [ ] Session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- [ ] `requireAuth` middleware using `SessionService.validate` (needed once
      protected routes exist).
- [ ] CSRF hardening review for cookie auth (SameSite, etc.).

---

## Backlog (roadmap)

- [ ] **Music registration** ("cadastrar músicas") — metadata + upload the audio
      file to R2 (ADR 0007). First write feature.
- [ ] **`GET /musics/:id`** — music info + presigned R2 URL to listen.
- [ ] **`GET /playlist`** — list available playlists.
- [ ] **Architecture reassessment** — when playlists gain real invariants (shared
      playlists), plan the hexagonal/DDD migration (ADR 0018 planned revisit).
