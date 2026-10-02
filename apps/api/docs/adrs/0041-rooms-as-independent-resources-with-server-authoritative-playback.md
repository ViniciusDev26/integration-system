# 0041. Rooms as independent resources, with server-authoritative playback

- Status: Accepted
- Date: 2026-10-02

## Context

The AV3 epic's second feature is rooms: create one, invite people, build its
track list together, and **listen at the same time**, with playback synchronized
across everyone in it.

Two things had to be settled before writing any of it.

**What a room is.** A room could have been a live session layered over an
existing collaborative playlist, reusing the tracks, membership, invites and
live propagation already built (ADR 0040, block 1). It was weighed and not
chosen: a room is to be a resource in its own right, with its own track list and
its own membership, not a view onto a playlist.

**Who owns the playback position.** Synchronized listening needs one answer to
"where are we in the track right now?". ADR 0039 explicitly left this open.

## Decision

### A room is its own resource

Three new tables, deliberately mirroring the playlist ones:

- `rooms` — id, name, timestamps, plus the playback anchor below.
- `room_members` — PK `(room_id, user_id)`, `type` OWNER|MEMBER, matching
  `playlist_members` so membership stays relational (ADR 0018).
- `room_musics` — PK `(room_id, music_id)`, many-to-many onto the existing
  `musics` table. Tracks themselves are **not** duplicated; only the
  association is.

### Playback is an anchor, not a tick

The server is the single source of truth, and it stores a **four-field anchor**
on the room:

```
current_music_id, position_ms, is_playing, playback_updated_at
```

That is the whole mechanism. The server does **not** tick, broadcast a clock, or
track anyone's progress. A client computes the live position itself:

```
isPlaying ? position_ms + (now - playback_updated_at) : position_ms
```

Commands — play, pause, seek, change track — are ordinary mutations that move
the anchor and publish it to the room. Because the anchor only changes when
somebody acts, writes are rare and persisting it costs nothing per second.

Persisted rather than in-memory, so a restart does not silently reset everyone's
session, and so the state is readable in the same query that loads the room.

### Presence is the lifetime of a subscription

Being *present* in a room is simply having `rooms.onChanged` open. The resolver
joins the `RoomRegistry` (ADR 0039 — this is its first consumer) when the stream
opens and leaves in `finally`, publishing a presence event either way. Nothing
has to be heartbeated or cleaned up: a dropped socket ends the iteration, which
releases the membership.

Presence is therefore distinct from membership: `room_members` says who *may*
enter, the registry says who *is here now*.

### Invites are reused, not reinvented

`ROOM` joins `INVITE_RESOURCE_TYPES`, and a `createRoomResourceMembership`
adapter is registered beside the playlist one (ADR 0040). Owner-only invites,
redeeming grants MEMBER. The invite module does not change — this is the case it
was built for.

## Consequences

- **Rooms duplicate playlist structure.** Two membership relations, two
  track-association relations, two repositories, two services with the same
  shape. This was the accepted cost of a room being autonomous rather than a
  view onto a playlist; the alternative traded that duplication for coupling
  room identity to a playlist's.
- **No server ticking.** The anchor is written only on a command, so a room with
  ten listeners costs the same as one with one. Clients do the arithmetic.
- **Clock skew becomes visible.** A client extrapolating from
  `playback_updated_at` compares a server timestamp against its own clock, so a
  badly-set client clock shifts its playback. Events carry the server's `now`
  alongside the anchor, letting a client measure its own offset and subtract it.
- **Drift is corrected on events, not continuously.** Between commands, clients
  free-run. Small divergence accumulates until the next command re-anchors
  everyone. Acceptable for listening together; it would not be for anything
  frame-accurate.
- **Presence does not survive the process.** The registry is in-memory, so
  scaling past one instance needs sticky routing or a shared store — the same
  limit ADR 0039 already records for the registry and the event bus.
- **A room's expiring playback URLs are now a sharper problem.** Presigned URLs
  last ~1 h (ADR 0007) and a listening session can outlast one, after which a
  newly-joining member receives a URL that works while an existing member's has
  already died. The `musics.playbackUrl` refresh procedure, already an open
  follow-up, becomes load-bearing here.

## Alternatives considered

- **A room as a live session over a playlist.** Reuses collaborative playlists
  wholesale: tracks, membership, invites and the `playlists.onChanged` stream
  would all have applied unchanged, leaving only presence, playback and chat to
  build. Not chosen — a room is wanted as its own thing, so that its track list
  and its membership are not entangled with a playlist that may be shared or
  edited elsewhere.

- **Host-authoritative playback**, where the owner's browser emits heartbeats
  and everyone follows. Simpler, with no server state at all. Rejected because
  the session then depends on one person's tab staying open and foregrounded —
  browsers throttle background timers, and the owner closing the tab would
  freeze everyone else.

- **Server-ticked playback**, broadcasting the position on an interval. Removes
  client-side extrapolation and clock-skew concerns entirely. Rejected for cost:
  a message per room per tick, forever, to tell listeners something they can
  compute from a timestamp they already have.

- **Keeping the anchor in memory** rather than in `rooms`. Avoids four columns
  and a migration. Rejected because a deploy or crash would silently reset every
  room mid-song, and because the state would then be unreadable from the same
  query that loads the room.
