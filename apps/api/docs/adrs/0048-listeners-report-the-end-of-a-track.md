# 0048. Listeners report the end of a track; the room advances once

- Status: Accepted
- Date: 2026-10-03
- Extends: [0041](./0041-rooms-as-independent-resources-with-server-authoritative-playback.md)

## Context

A room stopped when its track finished. Web ADR 0017 made that deliberate:
clients used to auto-advance locally, every listener reached the end at roughly
the same moment, and they raced to pick the next track. Refusing to advance was
the safe half of the fix, and it left the feature incomplete — a room played one
track and went quiet.

The obvious answer is for the server to advance the queue on its own. It cannot,
for a reason that is structural rather than incidental: **the server does not
know how long a track is.** Uploads go straight to R2 under a presigned URL
(ADR 0038) and playback is a redirect (ADR 0045), so the bytes never pass
through the API and nothing ever decoded them. There is no duration column, and
adding one would mean either trusting a number the browser supplies or putting
the API back in the data path.

The server also never ticks (ADR 0041): the anchor is written only when somebody
acts. Introducing a timer per playing room would be the first scheduled work in
the system, lost on restart, and wrong the moment the stored duration disagreed
with the real one.

## Decision

**Every listener reports the end of its track, and the room decides.**

`rooms.trackEnded({ roomId, musicId })` is a report, not a command. The
`musicId` is what makes it safe: only a report naming the track the room is
**actually on** can move it. The first report advances the room; every later one
describes a track the room has already left and changes nothing.

That check is made twice, on purpose:

- `anchorAfterTrackEnd` in the domain decides from the anchor and the queue —
  paused rooms, rooms on another track, and tracks that are not queued are all
  `stale`.
- `RoomRepository.advancePlayback` writes `WHERE id = ? AND current_music_id = ?`.
  The domain judged a room read a moment earlier; this judges the row. Two
  reports that both passed the first check still advance it once.

The second check is the one that actually holds under concurrency, and it is the
same trick `InviteRepository.revoke` uses to keep the first revocation.

Losing the race is **not an error**. The procedure answers
`{ advanced: false }`, which is the ordinary outcome for all but one listener.

**The queue does not wrap.** Running out stops the room on its last track at
position 0, because a room has no repeat mode and inventing one here would be a
separate decision.

## Consequences

- **A room plays through its queue**, which it did not. The gap web ADR 0017
  recorded is closed, and the race it refused to take on is resolved by the row
  rather than by a leader.
- **A room with no listeners never advances.** Nothing reports, so nothing
  moves. That is the honest consequence of not having durations, and it is
  harmless: a room nobody is listening to has nowhere to be.
- **A listener whose audio fails silently will not report**, and if it is the
  only listener the room stalls. The same is true of a tab the browser has
  frozen. Both are indistinguishable from "nobody is there".
- **The report is trusted to the extent that membership is.** A member can
  report the end of the current track early and skip it for everyone — which is
  exactly what `SELECT_TRACK` already lets any member do (ADR 0041), so it adds
  no authority. A non-member is refused.
- **`rooms.trackEnded` moves the anchor without being a `PlaybackCommand`.**
  ADR 0041's four commands remain what a *person* can ask for; this is the
  system reporting a fact. Keeping it out of the command union is what lets it
  carry the compare-and-swap key.
- Verified end to end with two browsers in one room, seeking to four seconds
  before the end: both advanced to the next track together with 0.000s drift,
  and at the end of the queue both stopped on the last track with the persisted
  anchor at `isPlaying: false, positionMs: 0`.

## Alternatives considered

- **A server timer per playing room.** The conventional answer. Rejected
  because it needs a duration the server has no way to know, and because it
  would be the first scheduled work in a system whose whole playback design is
  "write an anchor when someone acts, never tick" (ADR 0041). It also dies with
  the process, so a restart would leave every room stuck.

- **Store `durationMs` on `musics`**, supplied by the browser at
  `musics.create`, and derive the current track from the anchor by rolling
  forward across boundaries — a pure function both sides could run, like
  `livePositionMs`. Genuinely attractive, and the closest to the existing
  design. Rejected for now because every existing track has no duration and
  there is no way to backfill without downloading from R2, so the feature would
  work only for new uploads. Worth revisiting if durations become useful for
  other reasons.

- **Elect a leader among the listeners** — lowest `userId` present, say — and
  let only that one advance. Rejected: presence changes underneath the election,
  and a wrong answer means either a double-skip or a room that stalls anyway.
  The compare-and-swap achieves the same thing without anyone having to agree
  on who is in charge.

- **Let clients advance locally again**, accepting the race. Rejected for the
  reason web ADR 0017 gave: N clients each pick the next track and re-anchor,
  so the room jumps and restarts under everyone.
