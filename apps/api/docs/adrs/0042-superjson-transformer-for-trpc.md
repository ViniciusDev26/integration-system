# 0042. superjson as the tRPC data transformer

- Status: Accepted
- Date: 2026-10-02

## Context

tRPC was adopted for end-to-end types without codegen (ADR 0037), and ADR 0009
requires those types to be true — no escape hatches, no laundering.

They were not true. With no transformer configured, tRPC serializes with plain
JSON, so a `Date` returned by a procedure arrives at the client as a **string**
— while the inferred client type still says `Date`. This compiles:

```ts
invite.expiresAt.getTime()   // TypeError at runtime: not a function
```

Four fields already crossed that boundary (`invites.expiresAt`,
`invites.revokedAt`, the room's `playbackUpdatedAt`, and `rooms.get`'s
`serverNow`), plus every `createdAt`/`updatedAt` on a returned row. Nothing had
broken yet only because each call site defensively re-wrapped the value in
`new Date(...)` — a workaround applied per field, which every future field would
have to repeat, and which the type system actively argues against.

Rooms made it worse rather than theoretical: synchronized playback is arithmetic
on `playbackUpdatedAt` (ADR 0041), and a client that treats it as a string
computes `NaN` and silently desynchronizes.

## Decision

Configure **superjson** as the tRPC data transformer, on the server and on every
client link.

- Server: `initTRPC.context<Context>().create({ transformer: superjson })`.
- Client: on **each link** — `httpBatchLink({ transformer: superjson })` and
  `wsLink({ client, transformer: superjson })`. In tRPC v11 the transformer
  moved from the client to the links, and the client-level option now exists
  only as a type error pointing that out. A link left without it silently
  receives raw JSON.
- `Date` is what forced this, but `Map`, `Set`, `BigInt`, `RegExp` and an
  explicit `undefined` come with it.

### Guarded by a wire test

`src/trpc/transformer.wire.test.ts` makes real HTTP requests with supertest
(ADR 0034) and asserts a `Date` returns as a `Date`.

This test exists because the existing 238 router tests **cannot** catch a
missing transformer: they go through `createCaller`, which invokes the router
in-process and never serializes anything. They pass identically with it and
without it. Removing the transformer has to fail something, and this is it.

## Consequences

- **The inferred types become true**, which is the point. A client can call
  `.getTime()` on a `Date` because it is one.
- **Per-field `new Date(...)` workarounds go away**, and new date-bearing
  procedures need no special handling at the call site.
- **The wire format changes for every procedure.** Payloads are wrapped as
  `{ json, meta }`, so anything speaking to `/trpc` outside the typed client —
  a curl, a REST-ish consumer — must encode and decode the same way. There is no
  such consumer today; the SPA is the only client.
- **Payloads grow slightly**, by the `meta` map of type annotations. It is
  proportional to the number of non-JSON values, not to the payload, and is
  negligible for this app's responses.
- **Both sides must agree.** A mismatched or missing transformer on one link
  produces confusing decode failures rather than a clear error, so the wire test
  is the thing that keeps that from reaching anyone.
- One dependency, shared by both apps, at the same pinned version.

## Alternatives considered

- **A hand-written transformer for `Date` only.** No dependency, roughly
  twenty-five lines of `serialize`/`deserialize` walking the payload. Rejected:
  it is structural-serialization code, where the mistakes are subtle (nested
  objects, arrays of objects, `null` versus `undefined`, dates inside `Map`
  keys), and owning it buys nothing except avoiding a dependency that exists
  precisely to get this right. This is the case `AGENTS.md` §4 describes as a
  dependency being the correct answer.

- **Returning ISO strings from every procedure.** No dependency and no ADR:
  change each procedure's return type so the declared type matches reality, and
  parse at the call site. Rejected because it pushes the problem into every
  procedure and every consumer forever, and makes the API less expressive to
  avoid fixing the transport. It would also have left the room's playback
  arithmetic converting strings on both sides of a calculation that must agree
  exactly.

- **Leaving it, with defensive `new Date(...)` at each call site.** What was
  already happening. Rejected as a per-field workaround for a transport-level
  problem — it relies on every future author noticing that the type is lying.
