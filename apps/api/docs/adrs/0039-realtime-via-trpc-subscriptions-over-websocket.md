# 0039. Realtime via tRPC subscriptions over WebSocket

- Status: Accepted
- Date: 2026-09-14

## Context

The next milestone adds three realtime features: **shared playlists** (several
users editing one playlist, changes propagating live), **rooms** (create a room,
invite users, build a playlist together and listen in sync), and **chat** inside
a room.

All three need the **server to push** to connected clients. The current transport
is tRPC over HTTP (ADR 0037) — request/response only, so the server cannot
initiate. Something has to carry server→client messages.

Constraints that narrow the choice:

- End-to-end type safety derived from `AppRouter` is the reason tRPC was adopted
  (ADR 0037), and type-check escape hatches are banned (ADR 0009). A second
  transport with a hand-maintained contract erodes both.
- Every external/untyped boundary is validated at runtime with Zod (ADR 0011).
- Every new dependency needs justification, and the burden of proof is on adding
  it (`AGENTS.md` §4).
- The SPA and the API are **same-origin** (ADR 0036; web ADR 0007), so any
  persistent connection competes with ordinary API calls for the browser's
  per-origin connection budget.

## Decision

Use **tRPC subscriptions over WebSocket**: `wsLink` on the client and the `ws`
adapter (`@trpc/server/adapters/ws`) on the server. Both ship inside the already
installed `@trpc/client` / `@trpc/server` 11.18.0; the **only new dependency is
`ws`** (plus `@types/ws`).

- Subscriptions are declared as **procedures on the existing router**, so their
  input and output types reach the client through `AppRouter` exactly like
  queries and mutations, and their inputs are validated by `.input()` with Zod.
- The client uses `splitLink` to route `subscription` operations to `wsLink`
  while queries and mutations stay on the existing HTTP link — one router, two
  transports, one contract.
- The WebSocket server resolves the session cookie through the adapter's
  `createContext`, so an authenticated subscription is authenticated by the same
  path as every other protected procedure.
- Client→server traffic (sending a chat message, issuing a playback command)
  stays as **ordinary mutations**. Only server→client push goes over the socket.
- `ws` enters `apps/api/package.json` when implementation begins; this ADR is the
  justification required by `AGENTS.md` §4.

## Consequences

Easier:

- **One connection per browser tab, regardless of how many subscriptions are
  open.** `wsLink`'s request manager multiplexes every operation over a single
  socket, so the browser's per-origin connection budget stops being a design
  constraint.
- **Reconnection with exponential backoff and a ping/pong keep-alive** come with
  the client; neither has to be written or maintained.
- **No second contract.** A subscription is a procedure — typed, validated and
  reviewed like the rest of the API.

Harder, and accepted deliberately:

- **No rooms primitive.** Grouping connections and broadcasting to a subset is
  ours to build: an in-process registry of room → subscribers, plus an event
  emitter feeding the subscription generators. This is the one capability
  Socket.IO would have given for free, and losing it was an explicit choice.
- **No replay on reconnect.** The socket reconnects, but events emitted while it
  was down are lost unless we track and resend them. SSE's `Last-Event-ID`
  handling would have provided this; WebSocket does not.
- **Room state lives in the process.** An in-memory registry ties a room's
  participants to one instance, so scaling out needs sticky routing or an
  external pub/sub. Single-instance deployment makes this acceptable today;
  revisit before scaling horizontally.
- **Playback synchronization still needs its own design.** A shared socket does
  not by itself provide a single source of truth for playback position, nor
  tolerance for per-participant latency. Out of scope here.
- The deployment target must allow **WebSocket upgrades** through whatever
  terminates TLS.

## Alternatives considered

- **tRPC subscriptions over SSE (`httpSubscriptionLink`)** — zero new
  dependencies, and it resumes after a drop via `Last-Event-ID`. Rejected on
  **connection count**: the link builds a separate `EventSource` per
  subscription, with no pooling, so three concurrent subscriptions consume three
  of the browser's six HTTP/1.1 connections — and, being same-origin, they
  compete with ordinary API calls. HTTP/2 dissolves this in production, but local
  development proxies over HTTP/1.1, where two open tabs are enough to stall the
  app. tRPC recommends SSE as the default and it would be right for a *single*
  push channel; three is too many.

- **Socket.IO** — the strongest contender, and the initial choice. It brings
  rooms, namespaces, reconnection and transport fallbacks, and it *is* typed via
  `ServerToClientEvents` / `ClientToServerEvents` generics. Rejected because
  those types are a contract **written by hand on both sides** rather than
  derived from `AppRouter`, reintroducing precisely the drift ADR 0037 exists to
  prevent; because payloads would need a separate Zod layer to satisfy ADR 0011,
  which `.input()` supplies for free; because authentication would be
  reimplemented in the handshake instead of reusing `createContext`; and because
  it costs two dependencies (`socket.io`, `socket.io-client`) plus Engine.IO's
  non-standard framing layered over WebSocket. Its decisive advantage was rooms,
  accepted here as a loss to be solved another way.

- **Native `ws` without tRPC** — the same single dependency and full control, but
  a hand-rolled message protocol with hand-written types on both ends. Strictly
  worse than the chosen option, which uses that same dependency and inherits
  typing, validation and multiplexing from the router already in place.

- **A hosted realtime service (Ably, Pusher, Supabase Realtime)** — rooms,
  presence, reconnection and horizontal scale solved by the vendor. Rejected for
  now: it adds a **third external system** to operate, credential and pay for,
  with exactly the dependency failure modes the project's integration analysis
  already documents for GitHub and R2. Worth revisiting if room state outgrows a
  single instance.
