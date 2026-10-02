# 0044. Room chat, with durable replay

- Status: Accepted
- Date: 2026-10-02

## Context

The last AV3 feature is chat inside a room. It differs from everything built so
far in one way that drives the whole design.

Playlist and room events are **signals**: they say *something changed*, and a
client that missed one is correct simply by refetching, because the
authoritative state is one query away. That is why those subscriptions need no
replay (ADR 0041, and the correction appended to ADR 0039).

Chat messages are not signals. **They are the data.** A message missed during a
reconnect is content lost, and no refetch recovers it unless it was stored.

ADR 0039's correction already established that the transport supports this:
`tracked(id, data)` plus `lastEventId` resume a subscription over WebSocket, and
the server hands the resolver the last id the client saw so the resolver can
backfill. This is where that pays for itself.

## Decision

### Messages are persisted

A `room_messages` table — `id`, `room_id`, `user_id`, `body`, `created_at` —
with cascade deletes from both the room and the author.

### The id *is* the cursor

`id` is a UUIDv7, like every other id here (ADR 0025), and UUIDv7 is
time-ordered: its first 48 bits are a big-endian millisecond timestamp, so both
Postgres's `uuid` comparison and a plain string comparison sort by creation
time.

That means **no separate sequence column is needed**. `tracked(message.id, …)`
hands the client exactly the cursor that `where id > $lastEventId order by id`
consumes, and replay is served from PostgreSQL — durable, with no time window
and surviving a restart, unlike an in-memory buffer.

### Subscribe first, then backfill — the ordering matters

The obvious implementation loses messages:

```
query history after lastEventId   ← a message published now…
subscribe to the room's topic     ← …is never seen by either path
```

So the resolver does the opposite:

1. **Subscribe** to the room's message topic. The `EventBus` registers a
   subscriber eagerly and buffers from that instant (ADR 0039), which is what
   makes the window closeable at all.
2. **Query** the backfill from the database.
3. **Yield** the backfill, remembering the last id yielded.
4. **Yield** the buffered and subsequent live messages, **skipping any whose id
   is not greater than the last yielded** — because a message published during
   step 2 legitimately appears in both.

Without step 4's filter the overlap would be delivered twice; without step 1
coming first it would be delivered never. Both halves are tested.

### Who may read and send

Room members, enforced the same way everything else in a room is — membership
is checked before the stream opens and before a message is accepted. Sending is
an ordinary mutation; only receiving is a subscription.

### Bounds

A message is 1–2000 characters. The limit exists so a single mutation cannot
push an unbounded payload into the database and to every subscriber.

## Consequences

- **Conversations are stored indefinitely.** There is no retention policy and no
  deletion, by a user or otherwise. For a room that outlives its participants'
  interest, that is a growing table and a privacy consideration, both recorded
  rather than solved.
- **Replay is bounded by what was stored, not by a buffer.** A client offline
  for an hour gets everything it missed; one offline for a week does too. That
  is the durability the decision was made for, and also why the table grows.
- **The subscription does two things**, backfilling and then streaming, which
  makes its resolver the most intricate in the codebase. The ordering above is
  the reason, and the comments say so.
- **Joining a room shows its history**, including messages sent before you were
  invited. A room is treated as a shared space with a past, not a per-member
  view.
- **No rate limiting**, so a client may send as fast as it can mutate — the same
  gap that applies to every other mutation here.
- UUIDv7 as a cursor ties correctness to its time-ordering. Two messages written
  in the same millisecond order by their random bits, which is stable but
  arbitrary; for a chat that is indistinguishable from simultaneity.

## Alternatives considered

- **Ephemeral, in memory.** No migration, nothing stored, and a per-room ring
  buffer is simple. Rejected because the replay window would be bounded by that
  buffer and lost on deploy — precisely the shape of Socket.IO's
  `connectionStateRecovery` that ADR 0039 rejected for being two minutes long
  and not surviving a restart. Choosing it here would contradict that reasoning.

- **A separate monotonic sequence column** (`bigserial`) as the cursor, instead
  of reusing the id. More obviously ordered, and immune to any UUIDv7 subtlety.
  Rejected as redundant: the id already carries time ordering, and a second
  ordering key invites the two disagreeing.

- **Backfilling with a timestamp cursor** rather than an id. Rejected because
  two messages can share a millisecond, making `created_at > $t` either skip or
  repeat them; an id cursor is exact.

- **Persisting but pruning after some days.** Keeps durability while bounding
  growth. Not chosen now — it adds a cleanup job the project has nowhere to run,
  and the `sessions` table (ADR 0019) is still waiting for the same thing. Worth
  revisiting when either becomes a real problem.
