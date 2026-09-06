# Architecture — API (`apps/api`)

## Purpose of this document

This document describes the **architecture of the API app as it emerges** — its
structure, components, boundaries, data flows, and the key patterns that hold it
together. It answers *"how is this app put together?"*.

It is a **stable** document: it should reflect what is actually true and decided,
not speculation about what might be built.

- The **reasoning** behind individual decisions is recorded as ADRs in
  [`adrs/`](./adrs/) (this app's 0001–00NN). This document captures the resulting
  *shape*; the ADRs capture the *why*.
- This app lives in a monorepo (`apps/api`); repo-wide structure/tooling
  decisions are in the root [`docs/adrs/`](../../../docs/adrs/) (monorepo,
  shared Biome config).
- Volatile, in-progress notes belong in [`../../../memory.md`](../../../memory.md);
  the task tracker is [`../../../tasks.md`](../../../tasks.md).

See [`../AGENTS.md`](../AGENTS.md) (API app) and the root
[`../../../AGENTS.md`](../../../AGENTS.md) for how/when to update this document.

---

## Current architecture

A **server-side HTTP app** with a **server-rendered UI** (Handlebars, ADR 0030),
backed by PostgreSQL (Drizzle) for metadata and Cloudflare R2 (S3-compatible) for
audio/image binaries. It is **feature-modular** (vertical slices under
`src/modules/*`), with ports/adapters wired by hand in a composition root.

### Domain & scope

A **sample music service** (Spotify-like) with authenticated users. Implemented
surface:

- **Authentication** — GitHub OAuth, implemented manually with axios + Zod
  ([ADR 0020](./adrs/0020-manual-github-oauth.md),
  [ADR 0028](./adrs/0028-axios-http-client.md)); auth state is a **server-side
  session referenced by an httpOnly cookie**
  ([ADR 0016](./adrs/0016-session-httponly-cookie-auth.md)) stored in PostgreSQL
  ([ADR 0019](./adrs/0019-sessions-persisted-in-postgresql.md)). Routes
  `GET /auth/github`, `GET /auth/github/callback`, `POST /auth/logout`.
- **Music** — upload + create a track (audio + optional cover image) and list all
  tracks with short-lived playback/thumbnail URLs. Audio/images live in R2 via an
  `ObjectStorage` port ([ADR 0031](./adrs/0031-aws-s3-sdk-object-storage-port.md));
  uploads are multipart via multer ([ADR 0032](./adrs/0032-multer-multipart-upload-middleware.md)).
- **Playlists** — create a playlist (creator becomes its OWNER), view a playlist
  with its tracks, and add tracks. **Membership is relational** (`playlist_members`
  with `type` OWNER|MEMBER) rather than an `owner_id` column, so playlists can grow
  to shared/collaborative membership without a schema change. Owner-scoped listing.
- **Access control** — a `requireAuth` guard resolves the current user from the
  session cookie and redirects anonymous browsers to login; the playlist service
  enforces membership (403/404).

The app is **browser-first** (ADR 0030): mutations redirect (303) and the guard
redirects to login rather than returning JSON.

### Data model

Drizzle schema in `src/shared/db/schema/`, migrations in `drizzle/`. All tables
below are **implemented**; ids are UUIDv7 via PostgreSQL 18 `uuidv7()`
([ADR 0025](./adrs/0025-uuidv7-primary-keys.md)) unless noted.

- `users` — `id`, `github_id` (unique upsert key), `name`, `email` (unique),
  `image_url`, timestamps.
- `sessions` — `id` (opaque cookie token, not a UUIDv7), `user_id` → `users.id`
  (cascade), `expires_at`, `created_at`.
- `musics` — `id`, `name`, `genres` (**`text[]`**, free-text tags), `object_key`
  (R2 audio), `thumbnail_object_key` (nullable — optional cover), `uploaded_by` →
  `users.id` (cascade), timestamps.
- `playlists` — `id`, `name`, timestamps.
- `playlist_members` — PK `(playlist_id, user_id)`; `type` text with a CHECK
  constraint (`OWNER`|`MEMBER`); `user_id` index; cascades on playlist/user delete.
- `playlist_musics` — many-to-many join, PK `(playlist_id, music_id)`; cascades.

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
| Storage client/port | AWS S3 v3 SDK behind an `ObjectStorage` port | [ADR 0031](./adrs/0031-aws-s3-sdk-object-storage-port.md) |
| File uploads | multer (memory storage), multi-field | [ADR 0032](./adrs/0032-multer-multipart-upload-middleware.md) |
| Primary database | PostgreSQL (relational) | [ADR 0008](./adrs/0008-postgresql-relational-database.md) |
| Data access / ORM | Drizzle ORM + Drizzle Kit (migrations) | [ADR 0013](./adrs/0013-drizzle-orm-data-access.md) |
| DB driver | postgres.js (`postgres`) | [ADR 0024](./adrs/0024-postgres-driver-and-migrations.md) |
| Primary keys | UUIDv7 via PostgreSQL 18 `uuidv7()` | [ADR 0025](./adrs/0025-uuidv7-primary-keys.md) |
| Auth | GitHub OAuth, implemented manually (axios + Zod) | [ADR 0020](./adrs/0020-manual-github-oauth.md) |
| Session | Server-side session, httpOnly cookie (not JWT) | [ADR 0016](./adrs/0016-session-httponly-cookie-auth.md) |
| Session store | PostgreSQL (`sessions` table) | [ADR 0019](./adrs/0019-sessions-persisted-in-postgresql.md) |
| Request cookies | `cookie-parser` (read path) | [ADR 0033](./adrs/0033-cookie-parser-request-cookies.md) |
| Type safety | 100% type-safe, no escape hatches | [ADR 0009](./adrs/0009-strict-type-safety.md) |
| Lint / format | Biome (shared config package) | [ADR 0010](./adrs/0010-biome-linter-formatter.md) |
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

- **Feature-modular** ([ADR 0018](./adrs/0018-feature-modular-architecture.md)):
  each feature is a vertical slice under `src/modules/<feature>/`
  (`routes/controller/service/repository/schema`, with `*.types.ts` and
  `*.constants.ts` split out). Cross-cutting infra lives in `src/shared/`.
  Dependencies point inward (controller → service → repository); Express /
  Drizzle / R2 are edge concerns. Current modules: `auth`, `web`, `music`,
  `playlist`.
- **Code style & DI** ([ADR 0026](./adrs/0026-factory-functions-over-classes.md),
  [ADR 0027](./adrs/0027-di-ports-adapters-manual-composition-root.md)):
  repositories/services/controllers are **factory functions** (closures), not
  classes. Collaborators are **ports** (interfaces) with **adapter** factories
  (`createPostgres…`/`createR2…` for prod, in-memory fakes for tests); the graph
  is wired by hand in a **composition root** — no DI container.
- **Repository pattern** ([ADR 0014](./adrs/0014-repository-pattern-data-access.md)):
  all DB access goes through per-entity repositories; only repositories touch
  Drizzle. Services depend on repositories, not the ORM.
- **Object storage port** ([ADR 0031](./adrs/0031-aws-s3-sdk-object-storage-port.md)):
  binaries go through an `ObjectStorage` port (`put`, `getSignedUrl`) — R2 adapter
  in prod, in-memory fake in tests. The app never proxies media; it hands out
  short-lived presigned URLs.
- **Uploads at the boundary** ([ADR 0032](./adrs/0032-multer-multipart-upload-middleware.md)):
  multipart parsed by multer (memory storage) with per-field MIME allowlists +
  size limits; failures mapped to 400/413 before the handler runs.
- **TDD** ([ADR 0022](./adrs/0022-tdd-methodology.md)) + **testing**
  ([ADR 0015](./adrs/0015-testcontainers-repository-integration-tests.md)):
  repositories are integration-tested against real PostgreSQL via Testcontainers;
  services/controllers are unit-tested with fakes over the repository seam.
  Controllers are exercised over `createApp()` with **supertest** (ADR 0034).
- **HTTP input validation** ([ADR 0012](./adrs/0012-express-zod-safe-validation-middleware.md)):
  `express-zod-safe` at the route layer; handlers receive typed, validated input.
- **Local dev / container** (ADR 0021/0029/0023): `docker compose up` (from the
  repo root) brings up `postgres` + one-shot `migrate` + `app`; the multi-stage
  `Dockerfile` ships `dist/` + prod deps on `node:24.18.0-alpine`, non-root with a
  `/health` HEALTHCHECK. Compose is local-dev only.

### Execution & layout

Source under `src/`; `tsc` compiles to `dist/`; the app runs as
`node dist/server.js`. Commands run from the repo root via Turbo, or scoped with
`-w @integration-system/api` (see the root/app `AGENTS.md`).

**App/server split** — the Express app is built separately from the listener so
tests can import it (supertest) without binding a port. Collaborators are
injected (ADR 0027):

- `src/app.ts` — `createApp({ authController, webController, musicController,
  playlistController, requireAuth }): Express`; registers the Handlebars engine
  (ADR 0030), middleware (`express.urlencoded`, `express.json`, `cookie-parser`),
  the `/health` route, and mounts routers (`/` web, `/auth`, `/musics`,
  `/playlists`). No `listen`.
- `src/server.ts` — entry point; builds the graph via `createContainer()`,
  constructs controllers + the `requireAuth` guard (`redirectTo: /auth/github`),
  then `createApp(...)` and `app.listen(env.PORT)`.
- `src/container.ts` — **composition root** (ADR 0027): wires `db → repositories →
  services` with production adapters (Postgres repos, R2 `ObjectStorage`), exposing
  `authService`, `sessionService`, `objectStorage`, `musicService`,
  `playlistService`.
- `src/container-test.ts` — the **test** composition root: wires in-memory fakes
  for unit/controller tests **and** bootstraps a disposable Postgres
  (Testcontainers) for repository integration tests. (Replaces the former
  `src/test-support/`.)
- `src/shared/db/` — `index.ts` (`getDb()`/`closeDb()`), `database.ts` (the
  injected `Database` type), `schema/`.
- `src/shared/storage/` — the `ObjectStorage` port + R2 adapter + in-memory fake.
- `src/shared/http/` — `cookies.ts` (`readCookie`) and `upload.ts`
  (`createUpload`, `getUploadedFile`/`getOptionalFile`).
- `src/shared/env.ts` — validates `process.env` once with Zod (ADR 0009/0011) and
  exports a typed `env`: `NODE_ENV`, `PORT`, `DATABASE_URL`, `PUBLIC_BASE_URL`,
  `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `STORAGE_ACCOUNT_ID`,
  `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`. No other
  module reads `process.env` directly.
- `src/modules/auth/` — GitHub OAuth slice + `require-auth.ts` (the `requireAuth`
  guard and `getAuthenticatedUser` accessor).
- `src/modules/web/` — server-rendered home page.
- `src/modules/music/` — upload/create + listing (repository, service, controller,
  routes).
- `src/modules/playlist/` — create/view/add-tracks + owner-scoped listing, with
  membership-based authorization and typed domain errors.
- `src/views/` — Handlebars templates (layout + home, music upload/list, playlist
  new/list/detail); copied to `dist/views` on build.

Current routes:

- `GET /health` → `{ "status": "ok" }`.
- `GET /` → Spotifake home (signed-in user + nav, or a GitHub sign-in link).
- `GET /auth/github`, `GET /auth/github/callback`, `POST /auth/logout` (login/
  logout; cookies are `HttpOnly` + `SameSite=Lax`, `Secure` in production).
- `GET /musics` → list all tracks (players + thumbnails + genres). `GET
  /musics/new` → upload form. `POST /musics` → create (multipart: `name`,
  `genres`, `file`, optional `thumbnail`) → 303.
- `GET /playlists` → the user's playlists. `GET /playlists/new` → create form.
  `POST /playlists` → create → 303. `GET /playlists/:id` → tracks + add-track
  picker (403 non-member / 404 unknown). `POST /playlists/:id/musics` → add → 303.

All routes except `/health`, `/`, and `/auth/*` are behind `requireAuth`.

### What's next

The browser front-end is moving to a **Vite React SPA** (`apps/web`) that will
consume this app as a JSON API, with a persistent cross-page audio player. Those
front-end decisions are pending (see `apps/web/docs/adrs/`); the API's JSON
surface and any SSR→SPA transition will be recorded as ADRs here as they land.
