# memory.md

Evolving working memory for this project — a **volatile** scratchpad across
sessions/agents: current state, discoveries, open questions, temporary context.

It is **not** a replacement for stable documentation:

- Durable structural knowledge → each app's `docs/architecture.md`
  (e.g. [`apps/api/docs/architecture.md`](apps/api/docs/architecture.md)).
- Decisions with reasoning → ADRs: repo-wide in [`docs/adrs/`](docs/adrs/),
  per-app in `apps/*/docs/adrs/`.

When something here becomes stable or decided, promote it to the right place and
remove it from this file. Keep it pruned. See root `AGENTS.md` §5 for the rules.

> **Monorepo (2026-09-06):** repo is now Turborepo + npm workspaces
> (`docs/adrs/0001`): API in `apps/api`, Vite React scaffold in `apps/web`,
> shared Biome config in `packages/biome-config` (`docs/adrs/0002`). Run tasks
> from the root via turbo (`npm run build｜lint｜typecheck｜test｜dev`) or per app
> with `-w @integration-system/api｜web`. **Migrations** need `DATABASE_URL` in the
> env (no `--env-file`): e.g.
> `DATABASE_URL=postgres://user:password@localhost:5432/integration_system npm run db:migrate`.
> Seed script: `apps/api/scripts/` (git-ignored; from repo root:
> `node --env-file=.env apps/api/scripts/seed-musics.mjs`).

---

Pending work is tracked in [`tasks.md`](tasks.md); delivery-level epics in
[`roadmap.md`](roadmap.md).

## Current state

- **`apps/api` is a tRPC API** (ADR 0037; details in
  [`apps/api/docs/architecture.md`](apps/api/docs/architecture.md)): GitHub OAuth
  (only the **callback** is REST, `/auth/github/callback`) + server-side sessions;
  tRPC procedures `auth.startLogin`/`auth.me`/`auth.logout`,
  `musics.list`/`prepareUpload`/`create`,
  `playlists.list`/`create`/`get`/`addMusic`; `AppRouter` type exported for the
  web. **music**: multiple `genres` (`text[]`), optional thumbnail, **presigned
  direct-to-R2 upload** (ADR 0038 — `ObjectStorage.getUploadUrl`; `register` kept
  server-side for the seed). **playlists**: relational membership
  (`playlist_members` OWNER|MEMBER) with membership authz. Migrations `0000`–`0005`.
- **SSR removed** (ADR 0030 superseded by 0036) and **multer removed** (0032
  superseded by 0038): no `web` module / Handlebars / `requireAuth` middleware.
  The app serves `apps/web/dist` same-origin (guarded — inert until built).
- **`apps/web` SPA is built** (Fase 2): Vite + React + TS, Tailwind v4, React
  Router (ADR 0009), tRPC client + TanStack Query (`src/api/`, importing
  `AppRouter` from `@integration-system/api/trpc`, `credentials: "include"`), forms
  with react-hook-form + Zod. Screens: home/login, musics list, upload (presigned
  direct-to-R2), playlists list/new/detail. The API serves `apps/web/dist`
  same-origin (verified: `/` + deep links 200, `/trpc/auth.me` anon → 401).
- **Persistent player built** (ADR 0011): one hidden `<audio>` in the shell +
  `usePlayerStore` (Zustand); fixed control bar (cover, transport, seek/volume via
  shadcn/Radix Slider, repeat off/all/one). Playback **only via the player** (no
  inline audio). **Open follow-up:** presigned playback URLs expire (~1h) — add a
  `musics.playbackUrl` procedure to refresh on demand.
- **Spotify-style visual redesign done** (2026-09-06, ADRs 0012–0015): always-dark
  theme via Tailwind v4 tokens, a left-`Sidebar` shell replacing the old top-nav,
  `lucide-react` icons replacing emoji everywhere, and the shadcn CLI actually
  adopted (`components.json`) with `avatar`/`dropdown-menu`/`card`/`scroll-area`/
  `separator`/`badge` added. All 7 pages + `Player`/`Layout` restyled on top of the
  existing tRPC/Zustand data flow (no logic changes). Verified: `typecheck`,
  `lint`, `build` all pass; `/login` visually confirmed dark-themed via a headless
  Chromium screenshot (no console errors beyond the expected anonymous 401).
- **Realtime foundation built (2026-10-02, ADR 0039)** — transport only, no
  feature yet. `ws` 8.22.0 + `@types/ws` added. API: `attachTRPCWebSocketServer`
  (`src/trpc/ws-server.ts`) puts a `WebSocketServer` on the **same port and path**
  as HTTP (`/trpc`); upgrades are told apart by the `Upgrade` header.
  `createWSContextFactory` parses the handshake's raw `Cookie` (cookie-parser
  never runs on an upgrade — `parseCookieHeader` in `shared/http/cookies.ts`) and
  resolves the session via the same `AuthService.getCurrentUser`, so
  `protectedProcedure` works identically on both transports. Writing a cookie
  over ws **throws** rather than silently dropping it. Primitives in
  `src/shared/realtime/`: `EventBus` (topic fan-out, per-subscriber queues) and
  `RoomRegistry` (presence, refcounted per user so multiple tabs = one member).
  The registry is in the container; a bus is **not** — each feature will own one
  typed to its own events. Web: `splitLink` routes subscriptions to `wsLink`,
  with **one lazily-opened socket shared** by the React and standalone clients
  (`apps/web/src/api/links.ts`); Vite dev proxy forwards the upgrade (`ws: true`).
  Verified: typecheck, lint, 123 tests, build all green.
- **Room chat with durable replay (2026-10-02, ADR 0044)** — AV3 block 3 done,
  migration **`0009`** (`room_messages`). Messages are **the data, not a
  signal**, so this is the one subscription with replay: `tracked(id, …)` plus
  `lastEventId`, backfilled from Postgres. **The id is the cursor** — UUIDv7
  sorts by time, so no sequence column. **Ordering inside the resolver is
  load-bearing:** subscribe *first* (the bus buffers eagerly, ADR 0039), *then*
  query the backfill, then skip already-yielded ids — query-then-subscribe
  would drop a message published in between, and no skip would double it. Two
  tests hold `listAfter` open to force exactly that race. Chat runs on its own
  bus/topic (`room-chat:<id>`) so a playback command does not wake it.
  **Gotcha:** `tracked()` yields the raw envelope `[id, data, symbol]`, and
  tRPC converts it to `{id, data}` **only on the wire** — through
  `createCaller` the tuple arrives while the inferred type describes the
  converted shape. Narrow with tRPC's exported `isTrackedEnvelope`, not a cast.
- **Email/password auth (2026-10-02, ADR 0043)** — migration **`0008`**:
  `password_hash` added, `github_id` made **nullable**, plus a check constraint
  `github_id is not null or password_hash is not null` so a credential-less
  account cannot exist. argon2id behind a `PasswordHasher` port (fake in unit
  tests — argon2 is slow on purpose). **Linking is asymmetric on purpose:**
  GitHub login at an existing password account's email links (GitHub gives only
  `primary && verified`); password registration at an existing email is refused
  (nothing proves it is yours). Failed logins return one error for every cause
  and verify against a dummy hash when no user is found, so accounts are not
  enumerable by response or timing. Zod gotcha found: `z.email().trim()`
  validates **before** trimming — use
  `z.string().trim().toLowerCase().pipe(z.email())`. **musl verified, not
  assumed:** `npm ci` in the project's own Dockerfile `deps` stage installs
  `@node-rs/argon2-linux-x64-musl` and it loads in the Alpine image.
- **superjson is the tRPC transformer (2026-10-02, ADR 0042)** — set on the
  server *and on every client link* (`httpBatchLink` + `wsLink`); in tRPC v11 the
  transformer lives on the links, and the client-level option is only a type
  error pointing that out. Before this, `Date` crossed as a string while the
  inferred type said `Date` — the types lied, contradicting ADR 0009. **The 238
  router tests could not catch it**, because `createCaller` never serializes;
  `src/trpc/transformer.wire.test.ts` makes real supertest requests and is the
  only thing that fails if the transformer is removed.
- **Rooms are complete, API + UI (2026-10-02, ADR 0041)** — migration **`0007`**
  adds `rooms`/`room_members`/`room_musics` and widens the `invites` check to
  allow `ROOM`. A room is independent of playlists (own membership + queue),
  chosen over "live session over a playlist"; the duplication is the accepted
  cost. Playback is an **anchor, not a tick**: `{currentMusicId, positionMs,
  isPlaying, playbackUpdatedAt}` written only on a command, clients extrapolate
  `isPlaying ? positionMs + (now - playbackUpdatedAt) : positionMs`. The pure
  arithmetic is `src/modules/room/room.playback.ts` (14 tests). **Presence =
  the lifetime of `rooms.onChanged`** — joins the `RoomRegistry`, leaves in
  `finally`; first consumer of the block-0 registry. Any member may drive
  playback, not just the owner. Making rooms invitable cost **one adapter**;
  the typechecker forced every registry to supply `ROOM` because
  `ResourceMembershipRegistry` is `Record<InviteResourceType, …>`.
  Web: `useRoomPlaybackSync` imports `livePositionMs` **from the API workspace**
  (`@integration-system/api/playback`, a second package export) so client and
  server cannot disagree; the player store gained `seekTo`/`pendingSeek`, since
  only the `<audio>` element can seek and the command comes from outside it.
  **Known gap:** the global player's own transport buttons still act locally, so
  using them inside a room desyncs you until the next command re-anchors.
- **Shared playlists are live (2026-10-02)** — AV3 block 1 done. The playlist
  module owns an `EventBus<PlaylistEvent>`; `playlists.onChanged` streams
  `MUSIC_ADDED`/`MEMBER_JOINED` to members, `playlists.members` lists who
  belongs. **One bus instance is shared** by `PlaylistService` and
  `createPlaylistResourceMembership` in both composition roots — otherwise an
  invite-driven join would not reach anyone already watching. Events are
  **signals, not state**: the web client refetches on receipt, so a missed event
  is harmless and `tracked()` replay is not needed here (chat will need it).
  Gotcha found: a tRPC **subscription resolver does not run until the stream is
  first pulled**, so a non-member's `FORBIDDEN` surfaces on iteration, not on
  the call; and `createCaller` subscriptions take only the input, no options.
  Web: share panel on the playlist page + `/invite/:token`.
- **Invite links built (2026-10-02, ADR 0040)** — the API half of shared
  playlists; **no UI and no realtime yet**. An invite is an opaque token
  (`randomBytes(32).base64url`, like a session) addressing a
  `(resource_type, resource_id)` pair; migration **`0006`** adds `invites`.
  `src/modules/invite/` is **resource-agnostic**: it depends on a
  `ResourceMembership` port (`exists`/`canInvite`/`grant`), and
  `createPlaylistResourceMembership` is the whole coupling to playlists — rooms
  register a second adapter plus a second `INVITE_RESOURCE_TYPES` member and a
  wider CHECK, and the module itself does not change. Only an OWNER may invite;
  redeeming grants MEMBER; links are reusable, expire (7 d) and are revocable.
  `PlaylistRepository` gained `addMember` (idempotent — an OWNER redeeming their
  own link is not demoted) and `listByOwner` became **`listForMember`**, so a
  shared playlist shows up for the guest. Procedures: `invites.create`/`redeem`/
  `list`/`revoke`.
- **User's DB state:** compose Postgres is migrated through `0004`; **`0005` (playlists), `0006`
  (invites), `0007` (rooms), `0008` (password auth) and `0009` (chat) still need applying** before playlists or
  invites work against a live DB.

## DDD migration plan (intent)

The user wants to practice **DDD** on this project. Agreed plan: keep the
pragmatic feature-modular/layered architecture (ADR 0018) while the domain is
CRUD-ish; when **playlists** gain real invariants (shared/collaborative), revisit
and migrate toward **hexagonal + DDD** per module (repository ports already make
this seam cheap) and supersede ADR 0018 with a new architecture ADR. Tracked in
`tasks.md` → "Later"; the trigger is the AV3 epic in [`roadmap.md`](roadmap.md)
(shared playlists and rooms).

## Important discoveries (still operationally relevant)

- **Node 24 required** (ADR 0001) + `engine-strict` blocks older Node. Local mise
  default may be v22; Node 24.18.0 is pinned in `.tool-versions` (ADR 0035). Run
  tooling with Node 24 active (`mise use node@24` / auto-activation), or
  `mise exec -- <cmd>`.
- **Testcontainers hung on WSL2** resolving the Docker host to the bridge gateway
  `172.17.0.1`. Fix: `TESTCONTAINERS_HOST_OVERRIDE=localhost`, set (with `??=`) in
  `startTestDatabase` (`apps/api/src/container-test.ts`). Docker must be running
  for repository tests.
- **PG18 volume mount:** postgres:18 stores data in a subdirectory of the mount
  and crash-loops if mounted at `/var/lib/postgresql/data`. Compose mounts `pgdata`
  at `/var/lib/postgresql` (already fixed).
- **WSL2 + Docker Desktop + native TS7 `tsc-watch`** doesn't see host edits over
  the bind mount (no polling knobs in the Go compiler). Fallback: `docker compose
  restart app`, or run `npm run dev -w @integration-system/api` on the host with
  only Postgres in Compose.
- **Env is not auto-loaded.** The server/migrations read env from the process, not
  a `.env` by default. Run the server with `node --env-file=.env apps/api/dist/server.js`
  (+ `DATABASE_URL`); migrations need `DATABASE_URL` in the env (see the banner).
  Root `.env` carries `GITHUB_*` + `STORAGE_*` + `PUBLIC_BASE_URL`; it needs a
  `DATABASE_URL` too for host runs (compose provides it in-container).

## Open questions / follow-ups

- **Redesign not manually verified against a real authenticated session** — the
  headless-browser check only covered `/login` (no GitHub OAuth credentials
  available in this environment to reach the sidebar/authenticated pages). A
  human pass through `/`, `/musics`, `/playlists/:id`, and the player controls
  while logged in is recommended before considering the redesign fully done.
- Sidebar has **no responsive/mobile layout** — fixed `w-60`, no collapse below
  narrow viewports (ADR 0013 notes this as deliberately out of scope for now).
- **WebSocket upgrades not verified against a real deploy** — the transport is
  wired and tested locally, but nothing has confirmed that whatever terminates
  TLS in the deployment target passes an `Upgrade` through. Last open item of
  the realtime foundation (ADR 0039).
- **Replay is per-subscription work.** The transport resumes and hands the
  resolver a `lastEventId`, but each subscription must emit via `tracked()` and
  backfill from that id or a reconnect still drops events — see the dated
  correction at the end of ADR 0039. Matters most for chat.
- **Realtime transport decided (ADR 0039)** — tRPC subscriptions over WebSocket. Rationale, and why
  Socket.IO and SSE were rejected, are in the ADR; the epic and its risks are in
  [`roadmap.md`](roadmap.md). Operationally relevant leftover: `wsLink`
  multiplexes every subscription over **one socket per tab**, whereas
  `httpSubscriptionLink` opens one `EventSource` **per subscription** (verified
  in the installed 11.18.0 source) — worth remembering before anyone proposes
  SSE again.
- Session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- Validate the GitHub callback `iss` param (RFC 9207) instead of stripping it.
- Biome 2.5.12 `extends` is non-recursive and won't resolve package subpaths — the
  shared config is referenced by relative path (see `docs/adrs/0002`).

## Temporary context

- _(none)_
