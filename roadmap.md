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

**Status: planned** · not started

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

What it costs, accepted deliberately: **no rooms primitive** (Socket.IO's one
decisive advantage, given up on purpose) and **no replay on reconnect**.

### 0. Realtime foundation — do first

Nothing below ships without this.

- [ ] **Wire the WebSocket server** — `ws` + `@trpc/server/adapters/ws`
      alongside the existing HTTP handler; `createContext` resolving the session
      cookie so protected subscriptions authenticate identically to protected
      queries.
- [ ] **Client transport** — `splitLink` routing `subscription` operations to
      `wsLink` while queries and mutations stay on the current HTTP link.
- [ ] **Event bus** — an in-process emitter feeding the async generators behind
      each subscription.
- [ ] **Room registry** — `room → subscribers`, replacing what Socket.IO's rooms
      would have provided. In-process, which ties a room to a single instance
      (see risks).
- [ ] **Confirm WebSocket upgrades pass** through whatever terminates TLS in the
      deployment target.

### 1. Shared playlists

- [ ] More than one user editing the same playlist, with one user's change
      reaching the others without a page reload.
- [ ] Promote `playlist_members.type` from reserved to used: `MEMBER` already
      exists in the schema for exactly this, so **no migration is required**.
- [ ] Invite or join flow so a second member can exist at all.
- [ ] Subscription publishing playlist mutations to current members.

### 2. Rooms

- [ ] Create a room and invite other users to it.
- [ ] Participants build the room's playlist together.
- [ ] Everyone listens **simultaneously**, with playback synchronized across
      participants.
- [ ] Presence: who is currently in the room.

Playback synchronization is the hard part of this epic and needs its own design:
a single source of truth for position, and tolerance for per-participant
latency. ADR 0039 explicitly leaves it out of scope.

### 3. Chat

- [ ] Messages exchanged between participants of a room while music plays.
- [ ] Sending is an ordinary mutation; receiving is a subscription.
- [ ] Decide whether history is persisted or ephemeral — undecided.

### Risks and open questions

- **No replay on reconnect.** Events emitted while a socket was down are lost
  unless tracked and resent. SSE's `Last-Event-ID` would have given this for
  free; WebSocket does not.
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
