# 0017. A room session outlives the room page, and owns the transport

- Status: Accepted
- Date: 2026-10-02
- Relates to: api [0041](../../../apps/api/docs/adrs/0041-rooms-as-independent-resources-with-server-authoritative-playback.md), [0011](./0011-persistent-audio-player.md)

## Context

Testing a room with two real members surfaced four failures. The server was not
at fault in any of them: a probe with two WebSocket subscribers confirmed both
receive every `PLAYBACK_CHANGED`. All four were in the browser.

**The player bar did not command the room.** Its play/pause/next/seek drove the
local `<audio>` only. Inside a room that bar is the largest, most reachable
control on the screen — it owns the bottom edge — and pressing it moved one
listener and told nobody. Reproduced: the owner pressed *Next* in the bar, their
own player advanced, the guest did not move, and nothing reached the server.
`memory.md` had carried this as a known gap since rooms shipped.

**Following the room lived in the room page's lifetime.** `useRoomPlaybackSync`
was mounted by `RoomDetailPage`, but the audio is in the app shell and keeps
playing when you navigate. Reproduced: the guest opened `/musics` while
listening; the owner then paused, resumed and changed track, and the guest
followed none of it while still hearing the old track. That is the reported
*"the owner pauses and everyone keeps listening"*.

**Two listeners played the same track a second apart.** Measured, after the
three above were fixed, with one browser per listener: a **constant 1.17s**
offset that never closed. `seekTo` writes `audio.currentTime` once, at a moment
when the element may still be loading; the write is honoured late, against a
position the room has already left, and the gap is however long that client took
to load. The drift corrector never caught it because its tolerance was 2s.

**A listener who had not interacted could not be started at all.** A remote
`PLAY` calls `audio.play()`, which a browser refuses without a user gesture
(`NotAllowedError`). `Player` did `.catch(() => undefined)`, so the refusal
vanished and the UI showed a playing room over silence.

## Decision

### The room session is global state, like the player

A new `useRoomSessionStore` holds the room this browser is listening to, and a
`RoomSession` component in the **app shell** — not the page — owns that room's
`rooms.get` query, its `onChanged` subscription and the playback sync.

A room is something you are *in*, not a screen you are looking at. Opening
`/rooms/:id` enters the room; navigating away does **not** leave it, because
the audio does not stop either. Leaving is explicit, from the player bar.

Presence follows for free: presence is the subscription's lifetime (api ADR
0041), and that subscription now lasts as long as the listening does rather
than as long as the page is open — which is what presence was always supposed
to mean. The room page keeps its own `rooms.get` call; TanStack Query serves
both from one request because the key is the same.

### Transport buttons express intent; following an anchor does not

The player store gains a `remote` (`PlaybackRemote`) and a parallel set of
actions: `requestToggle`, `requestNext`, `requestPrevious`, `requestSeek`,
`requestPlayAt`. The bar's buttons call those, and they go to the `remote` when
one is registered. The plain `play`/`pause`/`seekTo`/`playQueue` stay local and
are what *follows* an anchor.

**That split is the whole design.** One set of actions for both would make a
room command itself in a loop: the anchor arrives, the client plays, playing
sends a command, which publishes an anchor.

The player knows nothing about rooms. `PlaybackRemote` carries a `label` and a
`leave`, so the bar can say *"Listening together in &lt;room&gt; — these controls
play for everyone"* and offer the way out, with no import from the room module.

Three controls behave differently under a remote, on purpose:

- **End of track does not auto-advance.** Every listener reaches the end at
  roughly the same moment and would race to pick the next track. The room waits
  for someone to choose. A leader would fix it; see Consequences.
- **"Previous" skips its local "restart if past the intro" shortcut**, because
  in a room previous means the previous track for everyone.
- **Removing from the queue is hidden**, since it is local-only and would
  silently desync the room's queue from this listener's.

### A seek waits until the element can honour it, and the corrector is tight

The player store tracks `canPlay`, set from the element's `canplay` and cleared
when a new source is assigned. `useRoomPlaybackSync` only seeks while it is
true, and re-runs when it flips — recomputing the target then, so the position
applied is the room's at the moment the seek actually lands, not at the moment
the event arrived.

The corrector moves from **2s every 5s to 0.5s every second**. Half a second is
the floor worth having, not a round number: `currentTime` reaches the store via
`timeupdate`, which fires about four times a second, so a reading is up to
~0.25s stale and a tighter window would seek on measurement noise.

Measured over two browsers, one per listener: worst drift **8ms** steady,
**42ms** across a track change, **18ms** after one listener browsed away and
the other resumed. Before: 1.17s, permanently.

### An autoplay refusal is reported, not swallowed

`Player` keeps the rejected promise, records `autoplayBlocked`, and the bar
shows *"Your browser is waiting for a tap before it plays audio"* with a **Tap
to listen** button — a gesture that is allowed to start the element.

### Any member still drives playback

Confirmed unchanged. ADR 0041 decided *"any member may drive playback, not just
the owner"*, and that was reconsidered and kept when these bugs were reported.
The complaint that everyone could pause was a symptom of the two sync failures
above, not of the permission.

The per-track button on the room page becomes an icon, like every other track
row in the app. The repeated `Play for all` label was noise, and the page
already says once, above the list, that playing changes it for everyone.

## Consequences

- **The bar is the room's remote**, which is what it looked like all along. One
  control surface instead of two that disagree.
- **A listener keeps following the room anywhere in the app**, and stays present
  while they do.
- **Leaving is now a deliberate act.** Without it, a listener who navigated away
  would stay present forever, so the bar carries a `Leave` that pauses and
  drops out.
- **A room stops at the end of a track** until someone picks the next one. This
  is a real gap introduced by refusing to let clients race; closing it needs
  the server to advance the queue itself, which is an api change and a new ADR.
- **`repeat` remains local**, and `repeat: "one"` is simply not consulted in a
  room because the end-of-track branch returns first.
- **Two stores now describe playback** — the player and the room session —
  joined only by `PlaybackRemote`. That seam is narrow on purpose; widening it
  would put rooms back inside the player.
- **The bar is a flex item in the shell column, no longer `fixed`.** The
  content area is sized around it instead of clearing it with a `pb-*` guess,
  which was already within 6px of being wrong once the room banner and the
  autoplay notice could both appear. ADR 0016's reasoning is untouched — the
  player still owns the bottom edge — only the mechanism changed.
- **The drift corrector now runs five times as often**, which is five timers a
  second doing arithmetic and, when it fires, a seek. Cheap, and the thing it
  buys is the feature working at all.
- Verified by driving two browsers over CDP with two real sessions, re-running
  each reproduction. **One browser per listener turned out to be essential:**
  two tabs in one headless instance leaves the background tab's media stuck at
  `readyState 0`, so it is dragged along by the corrector rather than playing —
  which looks exactly like a sync bug and is not one. Still no test framework in
  `apps/web`, so none of it is repeatable in CI; that gap is in `memory.md`.

## Alternatives considered

- **Disable the bar's transport inside a room**, leaving the page's buttons as
  the only way to command. Simpler and impossible to get wrong. Rejected
  because an inert bar with no explanation is its own bug, and it would not
  help the listener who navigated away — the case that started this.

- **Keep sync on the page and stop the audio when you leave it.** Honest, and
  much smaller. Rejected because it makes a listening room strictly worse than
  it is today: you could not look at the chat on another screen, or browse for
  a track to queue, without dropping out.

- **Mount `useRoomPlaybackSync` in the shell but leave the transport local.**
  Fixes the sync bug alone. Rejected as half a fix: the bar is where people
  press play, and it would still have been lying about what it does.

- **Elect a leader to advance the queue at the end of a track** — the lowest
  `userId` present, say. Rejected for now: presence changes under the election,
  and a wrong answer means either a double-skip or a room that stalls anyway.
  The server owning the queue is the right fix and belongs in its own decision.
