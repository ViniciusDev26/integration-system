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
- **A room plays through its queue (2026-10-03, ADR 0048)** — closes the gap
  web ADR 0017 opened by refusing to let clients auto-advance. **The server
  cannot time this itself:** it has no track durations, because uploads go
  straight to R2 (ADR 0038) and playback is a redirect (ADR 0045), so nothing
  server-side ever decoded the audio. So **every listener reports the end** via
  `rooms.trackEnded({roomId, musicId})` and the room advances exactly once.
  The `musicId` is the guard, checked twice: `anchorAfterTrackEnd` in the
  domain (paused / other track / not queued → `stale`) and then
  `advancePlayback` writing `WHERE id = ? AND current_music_id = ?` — the same
  compare-and-swap trick as `InviteRepository.revoke`, and the one that
  actually holds under concurrency. Losing the race answers
  `{advanced: false}`, which is the normal outcome for all but one listener,
  not an error. The queue **does not wrap**: running out stops the room on its
  last track at position 0 (rooms have no repeat mode).
  Consequence worth knowing: **a room with no listeners never advances**, since
  nothing reports. Harmless, but it is why a room can look stuck after everyone
  leaves. Verified with two browsers seeking to 4s before the end: advanced
  together with 0.000s drift, and stopped at the end of the queue.
- **The two `objectStorage` lint warnings are gone (2026-10-03)** — dead since
  ADR 0045 moved signing into the media controller. Removed from both services,
  their `*.service.types.ts`, both composition roots and two tests. `npm run
  lint` is now clean with zero warnings; keep it that way.
- **Room sync fixed where it was actually broken: the browser (2026-10-02,
  web ADR 0017).** Reported as "the room does not stay in sync". **The server
  was not at fault** — a probe with two WebSocket subscribers confirmed both
  receive every `PLAYBACK_CHANGED`, so do not start there next time. Three
  distinct client bugs, each reproduced with two real browsers over CDP:
  1. **The player bar did not command the room.** Its transport drove the local
     `<audio>` only, and it is the biggest control on the screen. Fixed with an
     intent seam in the player store: `requestToggle/Next/Previous/Seek/PlayAt`
     go to a registered `PlaybackRemote`; `play`/`pause`/`seekTo`/`playQueue`
     stay local and are what *follows* an anchor. **Keeping those two sets apart
     is load-bearing** — one set for both and the room commands itself in a loop.
  2. **Following lived in the room page's lifetime**, but the audio lives in the
     shell. Browse to `/musics` and you stopped following while still hearing
     the track. Fixed by moving the room to global state (`useRoomSessionStore`)
     with a shell-level `RoomSession` owning the query, the subscription and the
     sync. Presence rides along and now means "listening", not "looking at the
     page". Leaving is explicit, from the bar.
  3. **A listener who had not clicked anything could not be started remotely:**
     `audio.play()` rejects with `NotAllowedError` and `Player` swallowed it, so
     the UI showed a playing room over silence. Now recorded and the bar offers
     "Tap to listen".
  4. **A constant 1.17s offset between two listeners**, caught only because the
     user said the two browsers looked out of step — my own earlier numbers
     showed it and I had checked only play/pause/track, not position. Cause:
     `seekTo` writes `audio.currentTime` once, possibly before the media has
     loaded, so it lands late against a position the room has left; the gap is
     that client's load time and the 2s corrector never closed it. Fixed with a
     `canPlay` flag in the player store (set on the element's `canplay`, cleared
     on a new source) that the sync effect depends on — it re-anchors when the
     element can actually seek — plus the corrector at **0.5s every 1s**. Floor
     is ~0.5s because `currentTime` arrives via `timeupdate` (~4 Hz) and a
     tighter window seeks on noise. Measured after: 8ms steady, 42ms across a
     track change.
  **Measuring sync needs one browser per listener.** Two tabs in one headless
  Chromium leaves the background tab's media at `readyState 0` — it never
  plays, it is just dragged by the corrector in 5s steps — which looks exactly
  like a sync bug and is not one. Launch a second instance on another port.
  Also: the player bar is now a **flex item** in the shell column, not `fixed`,
  so content is sized around it instead of cleared with a `pb-*` guess.
  **The end-of-track gap this opened is now closed** — see the entry below.
  **Decision reconsidered and kept:** any member may drive playback (ADR 0041).
  The complaint that "everyone can pause" was a symptom of 1 and 2.
- **Every screen works on a phone (2026-10-02, web ADR 0016)** — the follow-up
  ADR 0013 deferred. The `w-60` sidebar becomes `hidden md:flex`; below `md` a
  slim top bar's menu button opens a **Radix `Dialog` drawer** (already a
  dependency, so focus trap/escape/scroll-lock come free — no `shadcn add`). Not
  a bottom tab bar: **the player already owns the bottom edge**. `NAV_ITEMS` +
  `navLinkClass` live in one module (`components/nav-items.ts`) so the sidebar
  and the drawer cannot drift; `UserMenu` is likewise shared.
  **The player bar wraps into two rows below `sm`** — three columns on one 390px
  row crushed the track title to `L…`. Volume is hidden on a phone (the device
  has one); transport, seek and queue stay. `sm:flex-nowrap` keeps desktop
  identical. Detail headers stack, covers shrink, `items-end` forms go
  column-first, and track-row buttons keep their labels in `hidden sm:inline`
  with an `aria-label` taking over.
  **Verified by driving headless Chromium over CDP against the running app with
  a real session** (not by reading breakpoints): all 9 routes at 390/360/1280px
  plus the drawer open and the player loaded, asserting
  `scrollWidth - clientWidth === 0` per route. Scripts are throwaway, in the
  session scratchpad. *Gotcha for next time:* `Runtime.evaluate` returns
  `{result: {result: {value}}}` — reading `.result.value` printed `undefined` for
  a whole run and silently looked like "no overflow".
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
- **Media is served by redirect, not presigned URLs (2026-10-02, ADR 0045)** —
  `GET /media/musics/:id` and `/cover` require a session and 302 to a freshly
  signed URL with `Cache-Control: no-store`; the three services now return those
  **stable paths**. Signing TTL dropped 1 h → 5 min, since it only has to
  outlive one redirect. **The API is still not a data path** (ADR 0038 holds):
  bytes go browser↔R2, only addressing passes through. Fixed covers too, which
  expired with the audio. Note the access gate is *a session*, not membership —
  `musics.list` returns the whole catalogue to any signed-in user, so track
  access was never scoped. Range-through-redirect is tested against a local
  object server; R2's own range support is inherited from the S3 contract, not
  measured here.
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
  **That known gap is closed** — see the room-session entry below.
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

**The trigger fired and the first step is done (2026-10-02).** AV3 gave the
domain real invariants, so **ADR 0046** now splits `domain/` from `application/`
inside a module that has them. It **extends** ADR 0018 rather than superseding
it — vertical slices stay; what changes is that such a module says which of its
code is which.

- The test: *can it be decided from the data in hand plus a timestamp, without
  awaiting anything?* Yes → `domain/`.
- **Done:** `invite/` (`domain/invite.ts` — redeemability, expiry, revocation)
  and `room/` (`domain/room.playback.ts` — the anchor rules, moved from the
  module root; `domain/room.queue.ts` — "a room plays from its own queue").
  Both services became `application/` and now translate outcomes to errors
  instead of deciding. Domain tests use no fakes, which is the signal.
- **Note:** the `@integration-system/api/playback` package export (the web
  imports `livePositionMs` from it) points at the new `room/domain/` path.
- **ADR 0047 (2026-10-02) takes it further, piloted on `invite/`:** the domain
  model is no longer the Drizzle row. `Invite` has one `resource` value where
  the table has two columns, and `token` is an `InviteToken` **value object**
  (branded type + validating constructor). `repository/invite.mapper.ts` is the
  only crossing point; the router returns DTOs from `application/invite.dto.ts`.
  - **Brands are type-level only**, so value objects survive serialization —
    that is what keeps `room/domain/room.playback.ts` importable and callable by
    the web client. Classes or closures would have broken it.
  - The `INVITE_RESOURCE_TYPES` union moved **into the domain**; the Drizzle
    schema imports it and derives the CHECK from it, so persistence depends on
    the model rather than the reverse.
  - Shared expiry rule extracted to `shared/domain/expiry.ts` — invites and
    sessions both treat the expiry instant as expired, and previously did so by
    coincidence of two implementations.
  - **Gotcha:** the web build compiles API source (package exports point at
    `.ts`), so an unused import in `shared/db/schema` fails the *web* build.
- **Next:** apply 0046+0047 to `auth/` (asymmetric linking is a real domain
  rule) and `sessions/` (expiry — my earlier note excluding it was wrong; it is
  a rule, not a guard). `playlist/` is marginal: its only candidate is a single
  role comparison duplicated in two adapters.
- **Deliberately excluded:** `media/`, `users/`, `sessions/` — guards, not
  invariants. An empty domain layer is worse than none.

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

- **The authenticated screens are now reachable headlessly**, which they were
  not when the redesign landed: email/password registration (ADR 0043) means a
  throwaway account can be created over `/trpc` and its session cookie set with
  `Network.setCookie`, so no GitHub credentials are needed. That closed the old
  "redesign only verified at `/login`" gap during the mobile pass (ADR 0016).
  Still unverified by a human on a real device: **touch** behaviour — tap
  targets, the drawer's swipe, and iOS Safari's dynamic viewport/safe area
  under the fixed player. Screenshots cannot see any of that.
- **`apps/web` has no test framework**, so every front-end change is verified by
  build + screenshot and nothing is repeatable in CI. Adding one needs an ADR.
  This is biting: the room-sync bugs (ADR 0017) were all client-side and all
  invisible to the 323 API tests.
- **A room with no listeners does not advance** (ADR 0048) — advancing is
  driven by listener reports, and an empty room has nobody to report. Fixing it
  properly needs track durations, which the server does not have.
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
