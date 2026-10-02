# Architecture — API (`apps/api`)

## Purpose of this document

Describes the **architecture of the API app as it emerges** — structure,
components, boundaries, data flows, and key patterns. It is **stable**: it
reflects what is true and decided.

- Reasoning behind decisions is in [`adrs/`](./adrs/) (this app's 0001–00NN); this
  captures the *shape*. Repo-wide decisions are in the root
  [`docs/adrs/`](../../../docs/adrs/).
- Volatile notes: [`../../../memory.md`](../../../memory.md). Tasks:
  [`../../../tasks.md`](../../../tasks.md). Update rules: [`../AGENTS.md`](../AGENTS.md).

---

## Current architecture

A **tRPC API** (ADR 0037) consumed by a Vite React SPA (`apps/web`) served
**same-origin** (ADR 0036); auth is a server-side session in an httpOnly cookie.
The router is served over **two transports on one port** (ADR 0039): HTTP for
queries and mutations, and **WebSocket for subscriptions**.
Metadata lives in PostgreSQL (Drizzle); audio/images live in Cloudflare R2, with
**browsers uploading directly via presigned URLs** (ADR 0038) — the API never
proxies the bytes. It is **feature-modular** (`src/modules/*`), ports/adapters
wired by hand in a composition root. There is **no server-side rendering**
(ADR 0030 superseded).

### Domain & scope

A sample music service (Spotify-like) with authenticated users:

- **Auth** — two ways in, both ending at the same server-side session
  (ADR 0016), so nothing downstream knows which was used: **email/password**
  (ADR 0043, argon2id via `auth.register` / `auth.login`) and **GitHub OAuth**
  (ADR 0020). `users.github_id` and `users.password_hash` are both nullable,
  with a check constraint requiring at least one. A GitHub login landing on an
  address that already has a password account **links** to it — GitHub only
  supplies verified addresses — while password registration on an existing
  address is refused, since nothing proves it is yours.
- **Auth (OAuth detail)** — GitHub OAuth (ADR 0020); the session is an httpOnly cookie (ADR 0016)
  stored in PostgreSQL (ADR 0019). Login start, current user, and logout are tRPC
  (`auth.startLogin` → returns the GitHub URL + sets the CSRF `state` cookie;
  `auth.me`; `auth.logout`). Only the **OAuth callback** stays REST
  (`GET /auth/github/callback`) — it's a browser redirect from GitHub and can't be
  tRPC.
- **Music** — list all tracks (stable `/media/...` paths, ADR 0045) and a two-step
  create: `musics.prepareUpload` returns presigned **PUT** URLs, the browser
  uploads audio (+ optional cover) straight to R2, then `musics.create` persists
  the row from the returned keys (ADR 0038).
- **Playlists** — create (creator becomes OWNER), view with tracks, add tracks.
  **Membership is relational** (`playlist_members`, `type` OWNER|MEMBER), enforced
  in the service. Listing is **membership-scoped**, so a playlist you were
  invited into appears beside the ones you created (ADR 0040). `playlists.members`
  lists who belongs, and `playlists.onChanged` streams a playlist's changes to
  its members over the WebSocket (ADR 0039) — the events are *signals*, so a
  client reacts by refetching and a missed one is harmless.
- **Rooms** — a listening room is its **own** resource (ADR 0041): its own
  membership (`room_members`) and its own queue (`room_musics`), not a view onto
  a playlist. Playback is **server-authoritative and anchored, not ticked**: the
  room stores `current_music_id / position_ms / is_playing / playback_updated_at`
  and clients derive the live position as
  `isPlaying ? positionMs + (now - playbackUpdatedAt) : positionMs`, so the
  server writes only when someone plays, pauses, seeks or changes track. Any
  member may command playback. **Presence is the lifetime of the
  `rooms.onChanged` subscription** — the resolver joins the `RoomRegistry` and
  leaves in `finally`, so a dropped socket cleans itself up.
- **Chat** — messages inside a room (ADR 0044), persisted in `room_messages`.
  Unlike every other subscription here, this one has **durable replay**: a
  message is the data, not a signal, so `rooms.onMessage` wraps each in
  `tracked(id, …)` and resumes from the client's `lastEventId` by querying
  PostgreSQL. The message id is the cursor — UUIDv7 is time-ordered, so no
  separate sequence column exists. The resolver **subscribes before querying**
  the backfill and skips already-yielded ids, which is what makes the handover
  neither lossy nor duplicating.
- **Invites** — a link is an opaque token addressing a
  `(resource_type, resource_id)` pair (ADR 0040). `invites.create` (owner only)
  issues one, `invites.redeem` grants MEMBER, `invites.list`/`invites.revoke`
  manage them. The module is **resource-agnostic**: it depends on a
  `ResourceMembership` port (`exists`/`canInvite`/`grant`) with one adapter per
  resource type registered in the composition root, so rooms will reuse it
  without the module changing.

### Data model

Drizzle schema in `src/shared/db/schema/`, migrations in `drizzle/`. Ids are
UUIDv7 (ADR 0025) unless noted.

- `users` — `id`, `github_id` (unique), `name`, `email` (unique), `image_url`, ts.
- `sessions` — `id` (opaque cookie token), `user_id` → `users.id` (cascade),
  `expires_at`, `created_at`.
- `musics` — `id`, `name`, `genres` (**`text[]`**), `object_key`,
  `thumbnail_object_key` (nullable), `uploaded_by` → `users.id` (cascade), ts.
- `playlists` — `id`, `name`, ts.
- `playlist_members` — PK `(playlist_id, user_id)`; `type` text + CHECK
  (`OWNER`|`MEMBER`); `user_id` index; cascades.
- `playlist_musics` — join, PK `(playlist_id, music_id)`; cascades.

### Technology stack

| Concern        | Choice            | Decision record |
| -------------- | ----------------- | --------------- |
| Runtime / Language | Node.js 24 / TypeScript | [0001](./adrs/0001-nodejs-24-and-typescript.md) |
| HTTP framework | Express (adapter host for tRPC + OAuth) | [0002](./adrs/0002-express-http-framework.md) |
| Password hashing | argon2id via `@node-rs/argon2` (prebuilt, musl-safe) | [0043](./adrs/0043-email-password-authentication-with-argon2id.md) |
| **API transport** | **tRPC** (end-to-end types, no codegen) | [0037](./adrs/0037-trpc-api-and-end-to-end-types.md) |
| **Wire format** | **superjson** transformer (so `Date` is a `Date`) | [0042](./adrs/0042-superjson-transformer-for-trpc.md) |
| **Realtime transport** | **WebSocket** (`ws`) carrying tRPC subscriptions | [0039](./adrs/0039-realtime-via-trpc-subscriptions-over-websocket.md) |
| **Invites** | Opaque-token links over a resource-agnostic port | [0040](./adrs/0040-resource-agnostic-invite-links.md) |
| **Rooms / sync playback** | Independent resource; anchored, server-authoritative | [0041](./adrs/0041-rooms-as-independent-resources-with-server-authoritative-playback.md) |
| **Chat** | Persisted messages, replayed from the id cursor | [0044](./adrs/0044-room-chat-with-durable-replay.md) |
| Runtime validation | Zod (tRPC `.input`, boundaries) | [0011](./adrs/0011-zod-runtime-validation.md) |
| OAuth callback validation | `express-zod-safe` (that one REST route) | [0012](./adrs/0012-express-zod-safe-validation-middleware.md) |
| Object storage | Cloudflare R2 (S3-compatible) | [0007](./adrs/0007-r2-object-storage-for-audio-files.md) |
| Storage client/port | AWS S3 v3 SDK behind an `ObjectStorage` port | [0031](./adrs/0031-aws-s3-sdk-object-storage-port.md) |
| **File upload** | **Presigned direct-to-R2** (PUT) | [0038](./adrs/0038-presigned-direct-r2-upload.md) |
| **Media reads** | `/media/...` redirect to a short-lived signed URL | [0045](./adrs/0045-media-redirect-endpoint-for-playback-urls.md) |
| Database / ORM | PostgreSQL / Drizzle + Drizzle Kit | [0008](./adrs/0008-postgresql-relational-database.md), [0013](./adrs/0013-drizzle-orm-data-access.md) |
| DB driver | postgres.js | [0024](./adrs/0024-postgres-driver-and-migrations.md) |
| Primary keys | UUIDv7 (`uuidv7()`, PG18) | [0025](./adrs/0025-uuidv7-primary-keys.md) |
| Auth | GitHub OAuth (manual) + httpOnly session | [0020](./adrs/0020-manual-github-oauth.md), [0016](./adrs/0016-session-httponly-cookie-auth.md), [0019](./adrs/0019-sessions-persisted-in-postgresql.md) |
| Request cookies | `cookie-parser` | [0033](./adrs/0033-cookie-parser-request-cookies.md) |
| Type safety / Lint | 100% type-safe / Biome (shared config) | [0009](./adrs/0009-strict-type-safety.md), [0010](./adrs/0010-biome-linter-formatter.md) |
| Architecture | Feature-modular, ports/adapters, factories | [0018](./adrs/0018-feature-modular-architecture.md), [0026](./adrs/0026-factory-functions-over-classes.md), [0027](./adrs/0027-di-ports-adapters-manual-composition-root.md) |
| Repository pattern | per-entity repos, only code touching Drizzle | [0014](./adrs/0014-repository-pattern-data-access.md) |
| Testing / TDD | Testcontainers (repos) + createCaller/units | [0015](./adrs/0015-testcontainers-repository-integration-tests.md), [0022](./adrs/0022-tdd-methodology.md), [0034](./adrs/0034-supertest-http-integration-testing.md) |
| Local dev / image | Docker Compose / multi-stage Dockerfile | [0021](./adrs/0021-docker-compose-local-database.md), [0029](./adrs/0029-docker-compose-full-dev-environment.md), [0023](./adrs/0023-dockerfile-production-image.md) |
| ESM | `type: module`, NodeNext | [0017](./adrs/0017-esm-module-system.md) |

Superseded: **[0030] SSR/Handlebars** (→ 0036, no SSR) and **[0032] multer** (→
0038, presigned upload).

### Patterns & conventions

- **tRPC transport** ([0037](./adrs/0037-trpc-api-and-end-to-end-types.md)):
  feature routers (`*.router.ts`) of thin procedures over the services;
  `publicProcedure`/`protectedProcedure` (401 → `UNAUTHORIZED`); Zod `.input`;
  context carries `{ req, res, user }` (user resolved from the session cookie);
  domain errors → tRPC `FORBIDDEN`/`NOT_FOUND`. The root router's type
  (`AppRouter`) is exported for the web client — end-to-end types, no codegen.
- **Object storage port** ([0031](./adrs/0031-aws-s3-sdk-object-storage-port.md) +
  [0038](./adrs/0038-presigned-direct-r2-upload.md)): `put` (server-side),
  `getSignedUrl` (presigned GET, playback), `getUploadUrl` (presigned PUT, direct
  upload). R2 adapter + in-memory fake.
- **Feature-modular / DI / Repository** (0018/0026/0027/0014): controllers/routers
  → services → repositories; only repositories touch Drizzle; the graph is wired
  in `src/container.ts` (prod) / `src/container-test.ts` (fakes + Testcontainers).
- **TDD + testing** (0022/0015): repositories integration-tested against real
  Postgres (Testcontainers); services and tRPC procedures unit-tested with fakes
  (procedures via `router.createCaller(ctx)`).
- **Local dev / container** (0021/0029/0023): `docker compose up` (repo root) →
  `postgres` + one-shot `migrate` + `app`; multi-stage Dockerfile ships `dist/` +
  prod deps, non-root, `/health` HEALTHCHECK.

### Execution & layout

Source under `src/`; `tsc` → `dist/`; runs as `node dist/server.js`. Commands run
from the repo root via Turbo or scoped with `-w @integration-system/api`.

- `src/app.ts` — `createApp({ authController, trpcRouter, createContext }): Express`:
  middleware (`express.json`, `urlencoded`, `cookie-parser`), `/health`, the tRPC
  middleware at **`/trpc`**, the OAuth routes at **`/auth`**, the media
  redirects at **`/media`** (ADR 0045), and (guarded) static
  serving of the SPA build (`apps/web/dist`) with an SPA fallback.
- `src/server.ts` — entry point: `createContainer()` → build the OAuth controller,
  the tRPC `AppRouter` (`createAppRouter`), and `createContext`
  (`createContextFactory`); `createApp(...)`; then an explicit `http.Server`
  (not `app.listen`) so `attachTRPCWebSocketServer` can share the port, and
  `listen`. `SIGTERM`/`SIGINT` close the socket server, which first asks
  clients to reconnect.
- `src/container.ts` — composition root: wires Postgres repos + R2 `ObjectStorage`
  into `authService`, `sessionService`, `musicService`, `playlistService`.
- `src/container-test.ts` — test composition root: in-memory fakes + Testcontainers
  bootstrap (`startTestDatabase`).
- `src/trpc/` — `trpc.ts` (init, `router`, `publicProcedure`, `protectedProcedure`,
  `createCallerFactory`), `context.ts` (`Context`, `createContextFactory` for
  HTTP and `createWSContextFactory` for the socket handshake), `router.ts`
  (`createAppRouter` + the exported `AppRouter` type), `ws-server.ts`
  (`attachTRPCWebSocketServer`), `trpc.constants.ts` (the shared `/trpc`
  endpoint + heartbeat timings).
- `src/shared/realtime/` — the primitives subscriptions are built from
  (ADR 0039): an `EventBus` port for topic fan-out (topics are `room:<id>`)
  and a `RoomRegistry` port for presence, each with an in-memory adapter.
  The registry is a container singleton; an `EventBus` is created per
  feature, typed to that feature's events.
- A module with **real invariants** separates **`domain/`** (pure rules — no
  port calls, no framework types, `now` as an argument) from **`application/`**
  (orchestration, and turning outcomes into typed errors) — ADR 0046. The
  signal it landed: domain tests use no fakes. Done for `invite/`;
  `room/room.playback.ts` is the reference shape; `media/` is deliberately
  excluded, having guards rather than invariants.
- Modules are split into **responsibility sub-modules** (ADR 0018): a module with
  more than one concern groups its files under `oauth/`, `service/`,
  `repository/`, `http/` rather than leaving them flat.
- `src/modules/auth/` — `oauth/` (GitHub OAuth client port + HTTP adapter + fake),
  `service/` (`AuthService`), `http/` (the OAuth callback controller/route +
  `auth.router.ts`: `startLogin`, `me`, `logout`).
- `src/modules/music/` — `repository/` + `service/` (`MusicService`: `listAll`,
  `prepareUpload`, `createFromKeys`, plus `register` for the seed); `music.router.ts`
  at the module root.
- `src/modules/playlist/` — `repository/` + `service/` (`PlaylistService` + typed
  domain errors); `playlist.router.ts` at the module root.
- `src/modules/sessions/` — `repository/` + `service/` (`SessionService`).
- `src/modules/users/` — repository only (single responsibility; stays flat).
- `src/shared/storage/` — `ObjectStorage` port + R2 adapter + in-memory fake.
- `src/shared/http/cookies.ts`, `src/shared/db/`, `src/shared/env.ts` (validates
  `NODE_ENV`, `PORT`, `DATABASE_URL`, `PUBLIC_BASE_URL`, `GITHUB_CLIENT_ID/SECRET`,
  `STORAGE_ACCOUNT_ID/ACCESS_KEY_ID/SECRET_ACCESS_KEY/BUCKET`).

Routes:

- `GET /health` → `{ status: "ok" }` (infra probe).
- `POST|GET /trpc/*` → tRPC (`auth.startLogin|me|logout`, `musics.list|
  prepareUpload|create`, `playlists.list|create|get|addMusic`).
- `GET /auth/github/callback` → the OAuth callback (the only REST route): sets the
  session cookie (`HttpOnly` + `SameSite=Lax`, `Secure` in prod) and redirects to
  the SPA.
- Non-`/trpc`/`/auth` GETs → the SPA `index.html` (when built).

### What's next

The `apps/web` SPA: a typed tRPC client + **TanStack Query** importing `AppRouter`,
the screens (login, musics + upload, playlists), and the persistent player.
