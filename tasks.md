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

- [x] **Prod DB client** — `src/shared/db/index.ts`: postgres.js + Drizzle
      client from `env.DATABASE_URL` (lazy: `getDb()`/`closeDb()`).
- [x] **Env schema** — added `DATABASE_URL`, `PUBLIC_BASE_URL` (trailing slash
      stripped), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` to `src/shared/env.ts`.
- [x] **Composition root** — `src/container.ts` (`createContainer()`): builds
      `db → repos → services → authService`, injecting production adapters (ADR 0027).
- [x] **Auth routes/controller** — `src/modules/auth/` (`auth.controller.ts`,
      `auth.routes.ts`), TDD via supertest (7 tests):
  - [x] `GET /auth/github` → 302 to `authService.getLoginUrl()`, `state` in a
        short-lived httpOnly cookie (`oauth_state`, 10 min).
  - [x] `GET /auth/github/callback` → `code` + `state` validated via
        `express-zod-safe` (ADR 0012); expected `state` from cookie →
        `authService.handleCallback` → session id in httpOnly cookie (`session`,
        ADR 0016) → redirect `/`. State mismatch → 401.
  - [x] `POST /auth/logout` → revoke session + clear cookie.
- [x] **Mount** the auth routes in `src/app.ts` (`createApp({ authController })`)
      + `cookie-parser`.
- [~] **Verify** — real server boots against live Postgres (compose) and
      `GET /auth/github` 302-redirects to real GitHub with the right
      params + state cookie; `/health` 200; callback 400 (missing) / 401 (bad
      state) confirmed. **Remaining (user, manual):** run `npm run db:migrate`
      (agent may not write to the DB) and complete a real browser login to
      exercise the `code` exchange — not automatable (ADR 0020 note).

Fixed along the way: `docker-compose.yml` mounted the volume at
`/var/lib/postgresql/data`, which **postgres:18** rejects on fresh init; moved it
to `/var/lib/postgresql` (PG18 stores data in a subdirectory).

- [x] **One-command dev env** (ADR 0029) — `docker compose up` brings up
      `postgres` + one-shot `migrate` + `app` (Dockerfile `dev` stage, source
      bind-mounted). `DATABASE_URL` provided by Compose. Verified: app builds,
      boots, serves `/health` + `/auth/github` in-container.
  - Caveat: `tsc-watch` hot reload doesn't see host edits on Docker Desktop +
    WSL2 with the native **TS7** compiler (no polling knob; fs events don't cross
    the mount). Fallback: `docker compose restart app` or host `npm run dev`.

### Follow-ups (auth)

- [ ] Session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- [x] `requireAuth` middleware (done — see "Foundations for uploads" below).
- [ ] CSRF hardening review for cookie auth (SameSite, etc.).
- [ ] Validate the GitHub callback `iss` param (RFC 9207) instead of just
      accepting it (currently stripped by the query schema).

---

## UI — server-side rendered (ADR 0030)

- [x] **Handlebars view layer** (`express-handlebars`): view engine in `app.ts`,
      templates in `src/views/` (`layouts/main.handlebars`, `home.handlebars`),
      copied to `dist/views` on build (`copy:views`).
- [x] **`web` module** (`src/modules/web/`): `GET /` renders the **Spotifake**
      home — signed-in user (avatar/name + logout) or "Sign in with GitHub".
- [x] `authService.getCurrentUser(sessionId)` (TDD) resolves the user from the
      session cookie; shared `readCookie` in `src/shared/http/cookies.ts`.
- [x] Auth actions made browser-friendly: `POST /auth/logout` now redirects to
      `/` (303); the login callback already redirects to `/`.
- [x] Removed `api.http` (superseded by the UI).
- [x] Fixed a latent bug: the prod `Dockerfile` build stage didn't copy
      `tsconfig.build.json` (used by `npm run build`) — now copied; image builds.

### Follow-ups (UI)

- [x] `requireAuth` middleware for protected pages/routes (done — see
      "Foundations for uploads"). Still needs mounting once such a page exists.
- [ ] Music/playlist pages once those features exist.

## Next up: music + playlists

Build under the current feature-modular architecture (ADR 0018), TDD (ADR 0022),
ports/adapters + composition root (ADR 0026/0027). Everything below is
authenticated — needs the **`requireAuth` middleware** first (see auth follow-up).

### 0. Foundations for uploads (do first)

- [x] **`requireAuth` middleware** (`src/modules/auth/require-auth.ts`, TDD) —
      `createRequireAuth({ authService, redirectTo? })`: reads the `session`
      cookie → `authService.getCurrentUser`; unauthenticated → 302 redirect when
      `redirectTo` is set (pages) else 401 JSON (API). Stashes the user on
      `res.locals`; handlers read it via the typed `getAuthenticatedUser(res)`
      accessor. Express 5 forwards store failures to the error handler (no silent
      bypass). Not yet wired into any route — mounted when the first protected
      route lands (music). 5 supertest tests.
- [x] **R2 storage adapter** (ADR 0007/**0031**) — `ObjectStorage` port
      (`put`, `getSignedUrl`) in `src/shared/storage/`, with `createR2ObjectStorage`
      (AWS S3 v3 SDK: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`, R2
      endpoint, `region: auto`) and an in-memory fake. The R2 adapter injects the
      `S3Client` + `presign` fn (axios-style DI, ADR 0028) → unit-tested with fakes,
      no network. Env (vendor-neutral to match the port, matching the provisioned
      `.env`): `STORAGE_ACCOUNT_ID`, `STORAGE_ACCESS_KEY_ID`,
      `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`. Wired into `container.ts`;
      boot verified (`/health` 200). 6 tests.
- [x] **`multer` upload middleware** (ADR **0032**) — `createAudioUpload()` in
      `src/shared/http/upload.ts`: multer v2, memory storage (→ `Buffer` for
      `ObjectStorage.put`), single file, audio MIME allowlist + size limit
      (`upload.constants.ts`). Maps failures to JSON at the boundary (bad
      type/missing → 400, too large → 413) so handlers stay thin; `getUploadedFile(req)`
      typed accessor mirrors `getAuthenticatedUser`. 6 supertest tests. Not yet
      mounted (lands with `POST /musics`).

### 1. Music module — upload & create (`src/modules/music/`)

- [x] **Schema + migration** — `musics` table (`src/shared/db/schema/musics.ts`):
      `id` (uuidv7), `name`, `genre`, `object_key` (R2), `uploaded_by` →
      `users.id` (cascade) + index, timestamps. `genre` is **free-text** (no enum,
      no ADR — open-ended). Migration `drizzle/0001_good_albert_cleary.sql`;
      applies cleanly (verified via Testcontainers integration run).
- [x] **`MusicRepository`** (port + postgres adapter + in-memory fake) — `create`,
      `findById`, `list` (newest-first). Integration-tested via Testcontainers
      (ADR 0015), incl. the uploader-cascade delete.
- [x] **`MusicService`** — `register({ name, genre, file, uploadedBy })`: puts the
      audio to storage via `ObjectStorage` (key `musics/<uuid><ext>`, injectable),
      then persists the row (bytes-first so a failed insert only leaks an orphan
      object). Unit-tested with fakes.
- [x] **Controller + routes** — `POST /musics` (multipart: `name`, `genre`,
      `file`): `requireAuth` → `multer` (ADR 0032) → `express-zod-safe` for the
      text fields → controller. Wired via `container.ts` → `server.ts` →
      `app.ts` (`/musics`). Supertest tests: 201 (+ stored object + row), 401
      anon, 400 no-file / missing-field / non-audio.
- [x] **UI** — upload form page (`src/views/music-upload.handlebars`) at
      `GET /musics/new`, posting multipart to `POST /musics`. Home links to it
      when signed in. To keep the app browser-first (ADR 0030, like the auth
      redirects): `requireAuth` now **redirects** anon visitors to `/auth/github`
      (via `redirectTo` in `server.ts`), and `POST /musics` **redirects 303** to
      `/musics/new?uploaded=1` (success banner) instead of returning JSON.
      Controller tests updated (render form, banner, redirects); boot smoke
      confirmed `GET /` + `GET /musics/new` (anon → 302 login).

- [x] **Multiple genres** — `musics.genre` (text) → `musics.genres` (`text[]`,
      not null, default `{}`); migrations `0003` (drop) + `0004` (add). Threaded
      through repo/service/controller (`RegisterMusicInput.genres`, `MusicListItem.genres`);
      the upload form takes a comma-separated `genres` field (split + de-duped by
      `parseGenres`); the listing renders one pill per genre. Local seed script
      (`scripts/`, git-ignored) reads the JSON's `genres` array.
- [x] **Thumbnails (optional cover image)** — `musics.thumbnail_object_key`
      (nullable) + migration `0002_sleepy_nekra.sql`. Upload middleware
      generalized to multi-field (`createUpload([...])`, `getUploadedFile(req,
      field)` / `getOptionalFile`); `POST /musics` now takes an optional
      `thumbnail` (image MIME allowlist, 5 MiB). `MusicService.register` stores it
      under `musics/thumbnails/<uuid><ext>`; listing exposes a presigned
      `thumbnailUrl` (or `null`). Upload form has a thumbnail input; listing shows
      the cover `<img>` (🎵 placeholder when absent).

### 2. Music listing — all musics

- [x] **`GET /musics`** — lists **ALL** musics (not user-scoped). `MusicService.listAll()`
      → repo `list()` (newest-first), mapping each to a `MusicListItem` with a
      presigned `playbackUrl` (`ObjectStorage.getSignedUrl`); the storage key is
      not leaked. `requireAuth` (redirect). Unit-tested (service + controller).
- [x] **UI** — `src/views/music-list.handlebars`: each track with genre + an
      `<audio controls>` playing the presigned URL; empty state; links to upload
      + home. Home links to "Browse tracks". Boot smoke: `GET /musics` anon → 302.

### 3. Playlist module (`src/modules/playlist/`)

Membership is a **relation**, not an `owner_id` column (per decision): a playlist
has many `playlist_members` with `type` OWNER|MEMBER, so it can grow to
shared/collaborative playlists without a schema change.

- [x] **Schema + migration** — `playlists` (`id`, `name`, timestamps);
      `playlist_members` (PK `(playlist_id, user_id)`, `type` text + CHECK
      OWNER|MEMBER, `user_id` index); `playlist_musics` join (PK
      `(playlist_id, music_id)`; many-to-many). Migration `0005`, cascades on
      playlist/user/music delete. Applies cleanly (Testcontainers).
- [x] **`PlaylistRepository`** (port + postgres + in-memory fake) — `create`
      (tx: playlist + OWNER row), `findById`, `listByOwner`, `getMemberType`
      (for authz), `addMusic` (dedupe), `listMusics` (in add order).
      Integration-tested (5): OWNER membership, owner-scoped listing, add/dedupe/
      order, cascade.
- [x] **`PlaylistService`** — `createForUser`, `listForUser`, `addMusic` (enforces
      the requester is a member via `getMemberType`; validates the music exists),
      `getWithMusics` (tracks + presigned URLs). Typed domain errors
      (`PlaylistNotFoundError`/`PlaylistForbiddenError`/`MusicNotFoundError`).
      Unit-tested with fakes.
- [x] **Controller + routes** — `GET /playlists`, `GET /playlists/new`,
      `POST /playlists`, `GET /playlists/:id`, `POST /playlists/:id/musics`; all
      `requireAuth`, membership errors mapped to 403/404. Wired through the
      composition root. Supertest-tested (incl. 403 non-member, 404 unknown, 400
      missing name).
- [x] **UI** — `playlist-new` (create form), `playlist-list` (owned playlists),
      `playlist-detail` (tracks with players/thumbnails/genres + add-track picker).
      Home links to "Your playlists". Boot smoke: `GET /playlists` anon → 302.

### 4. Playlist listing — only the current user's

- [x] **`GET /playlists`** — lists **only** playlists owned by the authenticated
      user (`PlaylistService.listForUser` → `listByOwner(currentUser.id)`).
      (Delivered with §3.)
- [x] **UI** — `playlist-list` page linking into each playlist's detail. (§3.)

### 5. Player module (`src/modules/player/`)

- [ ] **Player module** — a dedicated playback experience beyond the inline
      `<audio>` tags on the listing. Likely a "now playing" page/route that plays
      a selected track (and eventually a whole playlist) with transport controls
      (play/pause, next/previous, seek). Build under the current conventions:
      feature-modular (ADR 0018), SSR + Handlebars (ADR 0030), ports/adapters +
      composition root (ADR 0026/0027), TDD (ADR 0022); reuse
      `MusicService.listAll` / presigned URLs (ADR 0031) rather than re-fetching
      audio server-side.
  - **Decide first (scope):** single-track vs playlist/queue playback; pure
    server-rendered `<audio>` vs a small client-side player script; whether it
    needs its own state (now-playing / queue) or stays stateless.
  - A small **ADR** if it introduces client-side JS (departs from the current
    no-JS, server-redirect pattern) or a new playback state model.

### Later

- [ ] **Architecture reassessment** — when playlists gain real invariants (shared/
      collaborative playlists), plan the hexagonal/DDD migration (ADR 0018 revisit).
