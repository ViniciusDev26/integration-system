# Architecture

## Purpose of this document

This document describes the **architecture of the system as it emerges** — its
structure, components, boundaries, data flows, and the key patterns that hold
it together. It answers the question *"how is this system put together?"*.

It is a **stable** document: it should reflect what is actually true and
decided about the system, not speculation about what might be built.

- The **reasoning** behind individual architectural decisions is recorded
  separately as ADRs in [`adrs/`](./adrs/). This document captures the
  resulting *shape*; the ADRs capture the *why*.
- Volatile, in-progress notes and open questions belong in
  [`../memory.md`](../memory.md), not here.

See [`../AGENTS.md`](../AGENTS.md) for how and when to update this document.

---

## Current architecture

The system is a **server-side HTTP API**. Foundational technology choices have
been made; the internal structure and patterns are still to emerge.

### Domain & scope

A **sample music API**, similar to a Spotify-style service. It exposes music
metadata and playback URLs, with authenticated users. Planned surface:

- **Authentication** — social login via **GitHub** (OAuth), implemented
  manually with axios + Zod ([ADR 0020](./adrs/0020-manual-github-oauth.md),
  [ADR 0028](./adrs/0028-axios-http-client.md)); authenticated state kept as a
  **server-side session referenced by an httpOnly cookie**
  ([ADR 0016](./adrs/0016-session-httponly-cookie-auth.md)), with sessions stored
  in **PostgreSQL** ([ADR 0019](./adrs/0019-sessions-persisted-in-postgresql.md)).
  **Implemented and wired end to end** — routes `GET /auth/github`,
  `GET /auth/github/callback`, `POST /auth/logout` (see below).
- **`GET /playlist`** — list available playlists.
- **`GET /musics/:id`** — get a music's information plus a URL to listen.

Data is split between a **primary database** for metadata (users, playlists,
music info — relational vs NoSQL **decision pending**) and an **object store**
for the audio binaries (**Cloudflare R2**, S3-compatible —
[ADR 0007](./adrs/0007-r2-object-storage-for-audio-files.md)).

Data model — realized so far as Drizzle schema in `src/shared/db/schema/`
(migrations in `drizzle/`):

- `users` — identity from GitHub login: `id` (UUIDv7), `github_id` (unique,
  upsert key), `name`, `email` (unique), `image_url`, timestamps. **Implemented.**
- `sessions` — server-side sessions (ADR 0016/0019): `id` (opaque cookie token),
  `user_id` → `users.id` (cascade), `expires_at`, `created_at`. **Implemented.**

Planned (not yet modeled):

- `playlists` — available playlists
- `musics` — music metadata + R2 object key for the audio file
- `playlist_musics` — join table (many-to-many playlist↔music)

### Technology stack

| Concern        | Choice            | Decision record                                   |
| -------------- | ----------------- | ------------------------------------------------- |
| Runtime        | Node.js 24        | [ADR 0001](./adrs/0001-nodejs-24-and-typescript.md) |
| Language       | TypeScript        | [ADR 0001](./adrs/0001-nodejs-24-and-typescript.md) |
| HTTP framework | Express           | [ADR 0002](./adrs/0002-express-http-framework.md)   |
| View layer (SSR) | Handlebars (`express-handlebars`) | [ADR 0030](./adrs/0030-server-side-rendered-ui-handlebars.md) |
| Test framework | Vitest            | [ADR 0003](./adrs/0003-vitest-test-framework.md)    |
| Build          | `tsc` + recommended tsconfig | [ADR 0004](./adrs/0004-build-with-tsc-and-recommended-tsconfig.md) |
| Execution      | `node dist/server.js` (compiled) | [ADR 0005](./adrs/0005-execution-and-dev-workflow.md) |
| Package manager | npm (exact versions, npm-only) | [ADR 0006](./adrs/0006-npm-package-manager.md) |
| Object storage | Cloudflare R2 (S3-compatible) | [ADR 0007](./adrs/0007-r2-object-storage-for-audio-files.md) |
| Primary database | PostgreSQL (relational) | [ADR 0008](./adrs/0008-postgresql-relational-database.md) |
| Data access / ORM | Drizzle ORM + Drizzle Kit (migrations) | [ADR 0013](./adrs/0013-drizzle-orm-data-access.md) |
| DB driver | postgres.js (`postgres`) | [ADR 0024](./adrs/0024-postgres-driver-and-migrations.md) |
| Primary keys | UUIDv7 via PostgreSQL 18 `uuidv7()` | [ADR 0025](./adrs/0025-uuidv7-primary-keys.md) |
| Auth | GitHub OAuth, implemented manually (fetch + Zod) | [ADR 0020](./adrs/0020-manual-github-oauth.md) |
| Session | Server-side session, httpOnly cookie (not JWT) | [ADR 0016](./adrs/0016-session-httponly-cookie-auth.md) |
| Session store | PostgreSQL (`sessions` table) | [ADR 0019](./adrs/0019-sessions-persisted-in-postgresql.md) |
| Request cookies | `cookie-parser` (read path) | [ADR 0033](./adrs/0033-cookie-parser-request-cookies.md) |
| Type safety | 100% type-safe, no escape hatches | [ADR 0009](./adrs/0009-strict-type-safety.md) |
| Lint / format | Biome | [ADR 0010](./adrs/0010-biome-linter-formatter.md) |
| Runtime validation | Zod (at boundaries) | [ADR 0011](./adrs/0011-zod-runtime-validation.md) |
| HTTP input validation | `express-zod-safe` middleware | [ADR 0012](./adrs/0012-express-zod-safe-validation-middleware.md) |
| Module system | ESM (`type: module`, NodeNext) | [ADR 0017](./adrs/0017-esm-module-system.md) |
| Architecture | Feature-modular (vertical slice), layered | [ADR 0018](./adrs/0018-feature-modular-architecture.md) |
| Local database | Docker Compose (PostgreSQL) | [ADR 0021](./adrs/0021-docker-compose-local-database.md) |
| Local dev env | Docker Compose (db + migrate + app) | [ADR 0029](./adrs/0029-docker-compose-full-dev-environment.md) |
| App image | Multi-stage Dockerfile (Node 24 alpine) | [ADR 0023](./adrs/0023-dockerfile-production-image.md) |
| HTTP-level testing | `supertest` over `createApp()` | [ADR 0034](./adrs/0034-supertest-http-integration-testing.md) |
| Methodology | TDD (red → green → refactor) | [ADR 0022](./adrs/0022-tdd-methodology.md) |

### Patterns & conventions

- **Architecture — feature-modular** ([ADR 0018](./adrs/0018-feature-modular-architecture.md)):
  each feature is a vertical slice under `src/modules/<feature>/` with its own
  `routes/controller/service/repository/schema`. Cross-cutting infrastructure
  lives in `src/shared/`. Dependencies point inward (controller → service →
  repository); Express/Drizzle/R2 are edge concerns. Modules talk via
  services/public entry points — never by reaching into another module's
  internals. Module folders are created as features are built (no empty
  speculative scaffolding).
- **Code style & DI** ([ADR 0026](./adrs/0026-factory-functions-over-classes.md),
  [ADR 0027](./adrs/0027-di-ports-adapters-manual-composition-root.md)):
  repositories/services/controllers are **factory functions** (closures), not
  classes. Collaborators are **ports** (interfaces) with **adapter** factories
  (`createPostgres…` for prod, in-memory fakes for tests); the graph is wired by
  hand in a **composition root** — no DI container.
- **Data access — Repository pattern** ([ADR 0014](./adrs/0014-repository-pattern-data-access.md)):
  all database access goes through per-entity repositories; repositories are the
  only code that touches Drizzle directly. Services/handlers depend on
  repositories, not on the ORM. This seam is also the integration-test boundary
  and keeps the data layer free to diverge from a future domain layer.
- **Development methodology — TDD** ([ADR 0022](./adrs/0022-tdd-methodology.md)):
  feature code is written test-first (red → green → refactor).
- **Testing** ([ADR 0015](./adrs/0015-testcontainers-repository-integration-tests.md)):
  the repository layer is driven by **integration tests against real PostgreSQL
  via Testcontainers**; services/controllers by **unit tests** with fakes over
  the repository seam.
- **Local dev environment** ([ADR 0021](./adrs/0021-docker-compose-local-database.md),
  [ADR 0029](./adrs/0029-docker-compose-full-dev-environment.md)):
  `docker compose up` brings up the whole stack — `postgres`, a one-shot
  `migrate` (Drizzle migrations), and the `app` (Dockerfile `dev` stage, source
  bind-mounted, `DATABASE_URL` pointing at the `postgres` service). Requires a
  `.env` (GitHub OAuth secrets). `tsc-watch` auto-reloads where the platform
  delivers bind-mount file events; on Docker Desktop + WSL2 with the native TS7
  compiler it does not (restart the `app` service, or run `npm run dev` on the
  host with only Postgres in Compose). Compose stays **local-dev only**, not a
  deployment mechanism.
- **App container** ([ADR 0023](./adrs/0023-dockerfile-production-image.md)):
  multi-stage `Dockerfile` builds with `tsc` and ships `dist/` + prod deps on
  `node:24.18.0-alpine`; runs non-root with a `/health` HEALTHCHECK. Config is
  injected via environment at runtime.
- **HTTP input validation** ([ADR 0012](./adrs/0012-express-zod-safe-validation-middleware.md)):
  validated by `express-zod-safe` middleware at the route layer; handlers
  receive typed, validated input and contain business logic only.

### Execution & layout

Source lives under `src/`; `tsc` compiles to `dist/`; the app runs as
`node dist/server.js`. Development rebuilds and restarts on change via
`tsc-watch` ([ADR 0005](./adrs/0005-execution-and-dev-workflow.md)).

**App/server split** — the Express app is built separately from the process that
listens, so tests (supertest) can import and exercise the app without binding a
port. Collaborators are **injected** (ADR 0027), so the composition root owns all
wiring:

- `src/app.ts` — exports `createApp({ authController, webController }): Express`;
  registers the Handlebars view engine (ADR 0030), installs middleware
  (`express.urlencoded`, `express.json`, `cookie-parser`), the `/health` route,
  and mounts feature routers (`/` web pages, `/auth`). No `listen`.
- `src/server.ts` — entry point; builds the graph via `createContainer()`,
  constructs the `authController`, then `createApp(...)` and `app.listen(env.PORT)`.
- `src/container.ts` — **composition root** (ADR 0027): `createContainer()` wires
  `db → repositories → services → authService` with the production adapters.
- `src/shared/db/index.ts` — production DB client: `getDb()` lazily builds the
  postgres.js + Drizzle handle from `env.DATABASE_URL`; `closeDb()` tears it down.
  Only the composition root resolves it; repositories take the injected handle.
- `src/shared/env.ts` — validates `process.env` with Zod once and exports a
  typed `env` object (ADR 0009/0011): `NODE_ENV`, `PORT`, `DATABASE_URL`,
  `PUBLIC_BASE_URL`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`. **No other module
  reads `process.env` directly.**
- `src/modules/auth/` — auth feature slice: `auth.controller.ts` (HTTP layer:
  cookies, redirects, status), `auth.routes.ts` (router + `express-zod-safe`
  validation), over the existing `auth.service` / `github-oauth.client`.
- `src/modules/web/` — server-rendered pages (ADR 0030): `web.controller.ts`
  (builds the view model, renders Handlebars), `web.routes.ts`.
- `src/views/` — Handlebars templates (layout + pages); copied to `dist/views`.
- `src/shared/http/cookies.ts` — `readCookie`, the shared Zod-validated cookie
  reader used by the auth and web controllers.

Current routes:

- `GET /` → **Spotifake** home page (server-rendered, ADR 0030): signed-in user
  (GitHub avatar/name + logout form) or a "Sign in with GitHub" link.
- `GET /health` → `{ "status": "ok" }`.
- `GET /auth/github` → 302 to GitHub's authorize URL; issues the CSRF `state` in a
  short-lived httpOnly cookie (`oauth_state`).
- `GET /auth/github/callback` → validates `code`+`state` (middleware), checks the
  `state` cookie, runs the login, sets the `session` httpOnly cookie, redirects to `/`.
- `POST /auth/logout` → revokes the session, clears the cookie, redirects to `/`
  (303) so a browser `<form>` lands back on the home page.

Auth cookies are `HttpOnly` + `SameSite=Lax`; `Secure` is enabled when
`NODE_ENV=production` (ADR 0016).

**UI (server-side rendered, ADR 0030):** the `web` module (`src/modules/web/`)
renders pages with Handlebars. Templates live in `src/views/`
(`layouts/main.handlebars` + `home.handlebars`) and are copied to `dist/views` at
build time. Controllers pass a ready view model; templates hold no logic. The
web layer reads the session cookie and calls `authService.getCurrentUser` to
render auth state.

Node version is pinned to **24.18.0** via `.tool-versions` (mise, [ADR 0035](./adrs/0035-node-version-pinning-via-mise.md));
npm's `engine-strict` (ADR 0006) will refuse installs on an older Node.

### Not yet decided

Beyond the **auth** slice (GitHub login), the **web** slice (server-rendered
home page), and the health check, no feature components or domain boundaries
exist yet (music/playlist modules are planned). These sections will be filled in
as the architecture emerges, each significant decision recorded as an ADR.
