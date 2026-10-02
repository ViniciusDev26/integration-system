# Roadmap

Delivery-level view of the project, organized as **epics**. Each epic is a
graded milestone of the Systems Integration course this project doubles as.

This file answers *what was promised and what is promised next*. It is
deliberately coarse:

- Granular, actionable items → [`tasks.md`](./tasks.md).
- Current state, discoveries, open questions → [`memory.md`](./memory.md).
- Why a decision was made → ADRs: repo-wide in [`docs/adrs/`](./docs/adrs/),
  API-specific in [`apps/api/docs/adrs/`](./apps/api/docs/adrs/).

Legend: `[ ]` todo · `[~]` in progress · `[x]` done.

---

## Epic AV2 — Catalogue and playback over two external integrations

**Status: delivered** · built 2026-09-05 → 2026-09-06

### Goal

A music catalogue application that builds neither identity nor binary storage of
its own, delegating both to third-party systems and acting only as a consumer of
their published interfaces.

### Scope delivered

- [x] **Login with GitHub** — OAuth 2.0 Authorization Code flow, implemented
      manually without an auth library (ADR 0020). Server-side session
      referenced by an httpOnly cookie (ADR 0016), persisted in PostgreSQL
      (ADR 0019). CSRF on the flow guarded by a short-lived `oauth_state`
      cookie, checked in both the controller and the service.
      Procedures: `auth.startLogin`, `auth.me`, `auth.logout`, plus the single
      REST route `GET /auth/github/callback`.
- [x] **Music upload** — the browser `PUT`s the file straight to Cloudflare R2
      using a presigned URL; the API never receives the bytes (ADR 0038).
      Multiple genres (`text[]`), optional cover thumbnail, playback through
      short-lived presigned GET URLs so the bucket stays private.
      Procedures: `musics.prepareUpload`, `musics.create`, `musics.list`.
- [x] **Playlist creation** — create, list, open, and add tracks. Membership is
      modelled as a **relation** (`playlist_members`, `type` OWNER|MEMBER), not
      an `owner_id` column, so it can grow into collaborative playlists without
      a schema change. Tracks join through `playlist_musics` (many-to-many).
      Procedures: `playlists.list`, `playlists.create`, `playlists.get`,
      `playlists.addMusic`.
- [x] **SPA + persistent player** — Vite/React front end (`apps/web`) consuming
      the API through tRPC with types derived from `AppRouter` (ADR 0037), served
      same-origin so no CORS is needed (ADR 0036; web ADR 0007). One audio
      element in the app shell, a fixed control bar, and a queue panel that
      survives navigation (web ADR 0011).

### What this epic is really about

The two external integrations are the point, and they are one of each style the
course covers:

| Integration | Style | Analogue in the course material |
| ----------- | ----- | ------------------------------- |
| GitHub OAuth | API / service | ERP ↔ e-commerce platform |
| Cloudflare R2 | File transfer | TMS ↔ transport partner |

The written analysis lives in `report/` (git-ignored; the slide deck there is
tracked).

### Known gaps carried into AV3

- [ ] Presigned playback URLs expire after ~1 h with no refresh path — a
      `musics.playbackUrl` procedure is still missing. **This becomes sharper in
      AV3:** a shared listening session can easily outlive one hour.
- [ ] No rate limiting on any route, including presign issuance.
- [ ] No session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- [ ] The GitHub callback's `iss` parameter (RFC 9207) is stripped, not validated.
- [ ] No monitoring of either integration: a GitHub or R2 failure raises no
      alert, metric, or structured log.

---

## Epic AV3 — Realtime: shared playlists, rooms, and chat

**Status: delivered** · foundation, shared playlists, rooms and chat — all 2026-10-02

### Goal

Turn a single-user catalogue into something people use *together*, in real time.

### Transport decision

Settled in **ADR 0039**: tRPC subscriptions over WebSocket — `wsLink` on the
client, `@trpc/server/adapters/ws` on the server, with `ws` as the only new
dependency.

What this buys: subscriptions are procedures on the existing router, so their
types flow from `AppRouter` and their inputs are validated by Zod like every
other call; all subscriptions multiplex over **one socket per browser tab**; and
authentication reuses the same cookie-based `createContext`.

What it costs, accepted deliberately: **no rooms primitive** — Socket.IO's one
decisive advantage, given up on purpose.

The ADR also claimed there was no replay on reconnect. That was wrong, and its
dated correction records why: `tracked(id, data)` plus `lastEventId` resume a
subscription over WebSocket, with the backfill served from PostgreSQL — so it
survives a restart and has no time window, unlike Socket.IO's two-minute
in-memory buffer.

### 0. Realtime foundation — do first

Nothing below ships without this.

- [x] **WebSocket server wired** — `ws` 8.22.0 + `@trpc/server/adapters/ws`
      sharing the HTTP server's port, via `attachTRPCWebSocketServer`
      (`src/trpc/ws-server.ts`). `createWSContextFactory` parses the handshake's
      raw `Cookie` header — `cookie-parser` never runs on an upgrade — and
      resolves the session through the same `AuthService.getCurrentUser` the HTTP
      transport uses, so `protectedProcedure` behaves identically on both.
      Heartbeat on; shutdown asks clients to reconnect before closing.
- [x] **Client transport** — `splitLink` sends `subscription` operations to
      `wsLink` and keeps queries/mutations on the HTTP link
      (`apps/web/src/api/links.ts`). One lazily-opened socket is shared by the
      React and standalone clients, so a tab holds one connection, not two. The
      Vite dev proxy forwards the upgrade (`ws: true`).
- [x] **Event bus** — `EventBus` port + in-memory adapter
      (`src/shared/realtime/`), per-subscriber queues so nothing is lost between
      iterations, released on abort. Not wired into the container: each feature
      will own one typed to its own events rather than a single bus carrying a
      union of everything.
- [x] **Room registry** — `RoomRegistry` port + in-memory adapter, replacing
      Socket.IO's rooms. Membership is reference-counted per user, so one person
      with three tabs is one member who stays present until the last tab closes.
      Wired into the container as a singleton.
- [ ] **Confirm WebSocket upgrades pass** through whatever terminates TLS in the
      deployment target. Still open — it cannot be verified from here.

### 1. Shared playlists

- [x] **Invite flow, resource-agnostic** (ADR 0040) — an invite is an opaque
      token addressing a `(resource_type, resource_id)` pair. The module depends
      on a `ResourceMembership` port and never learns what a playlist is; rooms
      will register a second adapter rather than need a second module.
      Procedures: `invites.create` / `redeem` / `list` / `revoke`. Migration
      `0006` adds the `invites` table.
- [x] **`MEMBER` promoted from reserved to used** — `PlaylistRepository` gained
      `addMember` (idempotent, so an OWNER redeeming their own link is not
      demoted), and owner-scoped listing became membership-scoped, so an invited
      playlist shows up for the guest.
- [x] **Live propagation** — `playlists.onChanged` streams a playlist's changes
      to its members over the WebSocket. Membership is checked before anything
      is yielded, so an outsider gets `FORBIDDEN` rather than a silent stream.
      `MUSIC_ADDED` is published after the write lands; `MEMBER_JOINED` only on
      a real join, so a repeated redeem does not announce an arrival twice.
- [x] **Web UI** — a share panel on the playlist page (members with roles, and
      for the owner: create, copy and revoke links), plus `/invite/:token`,
      which redeems and lands the person on the playlist. The page refetches
      when an event arrives.

A design note, revising what this section used to say. These events are
**signals, not state**: each says enough to know what to refetch, and the
authoritative data stays one query away. That makes a missed event harmless and
`tracked()` replay unnecessary *here* — a reconnecting client is correct simply
by refetching. Chat will be the opposite case, because there the messages are
the data, and that is where `tracked()` earns its place.

### 2. Rooms

Designed in **ADR 0041**. A room is its **own** resource — own membership, own
queue — rather than a live session over a playlist. That was a deliberate choice
to keep a room's track list from being entangled with a playlist edited
elsewhere, and its accepted cost is structure duplicated from playlists.

**API — done:**

- [x] **Create a room and invite people** — `rooms.create`, and `ROOM` added to
      the invite resource types. Making rooms invitable cost exactly one new
      adapter (`createRoomResourceMembership`): the invite module from ADR 0040
      was not touched, which is what it was built for. The typechecker enforced
      it, since the registry is keyed by resource type.
- [x] **Build the queue together** — `rooms.queueMusic`, announced to the room.
- [x] **Synchronized playback** — server-authoritative and **anchored, not
      ticked**: `{currentMusicId, positionMs, isPlaying, playbackUpdatedAt}` is
      written only on a command, and clients extrapolate. Any member may drive.
      The arithmetic lives in a pure module with its own tests.
- [x] **Presence** — the lifetime of the `rooms.onChanged` subscription, via the
      `RoomRegistry` built in block 0; this is its first consumer. Membership is
      who *may* enter, presence is who *is here*.

**Web — done:**

- [x] **Rooms UI** — list and create rooms, queue tracks, see who is listening
      (a dot on the avatar marks presence, which is not the same as membership),
      and transport controls that issue **server** commands rather than driving
      the local player.
- [x] **Following the anchor** — `useRoomPlaybackSync` imports `livePositionMs`
      from the API workspace rather than reimplementing it, so the two sides
      cannot disagree about where the room is. Clock skew is measured against
      the server's `now` and subtracted; between anchors a 5 s check nudges a
      drifting listener back.
- [x] **Share panel is resource-agnostic** too — one component serves playlists
      and rooms, mirroring the invite module behind it.

**Still to do:**

- [ ] **The global player's own transport buttons act locally.** Press pause on
      the bottom bar while in a room and you leave the room's position until the
      next command re-anchors you. The room page's controls are the correct ones;
      making the shared player aware of room mode is the real fix.
- [ ] A room outliving a presigned URL (~1 h) is now a real failure, not a
      papercut: `musics.playbackUrl` is the missing piece.
- [ ] Nothing stops a room from advancing to the next track when one ends —
      playback simply stops at the end of a track.

### Along the way — email/password sign-in

- [x] **Email and password** (ADR 0043), added before chat so the app is usable
      without a GitHub account. argon2id via `@node-rs/argon2`; `github_id` and
      `password_hash` are both nullable with a check constraint requiring at
      least one. Migration `0008`.
- [x] **Asymmetric account linking** — a GitHub login at an address that already
      has a password account joins it, because GitHub supplies only verified
      addresses; password registration at an existing address is refused,
      because nothing proves it is yours.
- [ ] **No email verification, no password reset, no rate limiting.** All three
      are real gaps: registration therefore discloses whether an address is in
      use, and a forgotten password is unrecoverable.

### 3. Chat

Designed in **ADR 0044**. This is the feature the whole realtime foundation was
pointed at: messages are **the data, not a signal**, so a missed one is content
lost and no refetch recovers it.

- [x] **Messages persisted** in `room_messages` (migration `0009`), so replay is
      durable, has no time window and survives a restart.
- [x] **The id is the cursor** — UUIDv7 is time-ordered, so `tracked(id, …)` on
      the wire and `where id > $lastEventId` in Postgres agree, with no separate
      sequence column.
- [x] **Subscribe before querying** — the resolver opens the subscription first
      and skips already-yielded ids, so a message published during the backfill
      is delivered exactly once rather than lost or doubled. Both halves have
      tests that hold the query open to force the race.
- [x] **Sending is a mutation, receiving a subscription**, as planned; chat runs
      on its own topic so a playback command does not wake it.
- [x] **Web UI** — history and live messages merged by id, in one room panel.

Still open: no retention policy (conversations are kept indefinitely), no
deletion, and no rate limiting.

### Risks and open questions

- **Replay has to be implemented per subscription.** The transport resumes and
  hands the resolver a `lastEventId`, but each subscription must emit through
  `tracked()` and backfill from that id, or a reconnect still loses events.
  Playlists sidestep this by emitting signals and refetching; **chat cannot**,
  since there the messages are the data.
- **Room state lives in process memory.** Scaling beyond one instance needs
  sticky routing or external pub/sub. Acceptable now, not forever.
- **Expiring playback URLs** (carried from AV2) directly threaten a synchronized
  listening session longer than an hour.
- **Chat persistence** is undecided, and it changes the data model if the answer
  is "persisted".
- **Architecture reassessment** — `memory.md` records the intent to revisit
  ADR 0018 and migrate toward hexagonal/DDD "when playlists gain real
  invariants". Shared playlists and rooms *are* that trigger.

### Explicitly out of scope

- A rooms primitive from a library — building it is the accepted trade-off of
  ADR 0039.
- A hosted realtime service (Ably, Pusher, Supabase Realtime). Rejected in
  ADR 0039 because it would add a **third external system**; worth revisiting
  only if room state outgrows a single instance.
