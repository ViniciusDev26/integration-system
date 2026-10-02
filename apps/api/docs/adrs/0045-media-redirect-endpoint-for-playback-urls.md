# 0045. A media redirect endpoint, instead of presigned URLs that expire

- Status: Accepted
- Date: 2026-10-02

## Context

Playback and cover URLs are presigned R2 links with a one-hour lifetime
(ADR 0007). They are generated at read time in three services — `musics.list`,
`playlists.get` and `rooms.get` — and handed to the client, which stores them:
the player's queue holds the URL it was given.

That makes the lifetime a correctness problem, not a detail:

- **A session outlives the URL.** A room listening together for more than an
  hour stops working mid-track, and ADR 0041 already recorded this as the thing
  rooms made sharp rather than theoretical.
- **Covers die too.** The same signing is used for thumbnails, so after an hour
  the page breaks visually as well as audibly.
- **Nothing refreshes.** The URL is captured into the player store, so even
  navigating does not renew it.
- **A leaked URL is a bearer credential.** For up to an hour it serves the
  object to **anyone, with no session at all** — from a shared link, a log, or
  devtools.

A `musics.playbackUrl` procedure to re-issue on demand has been the assumed fix
in `roadmap.md` for some time. It treats the symptom: the client then has to
notice expiry, preserve its position while reloading a track mid-play, renew
covers separately, and do all of that per tab and, in a room, per participant.

## Decision

Stop giving the client a URL that expires. Serve media through **our own
origin**, as a redirect:

```
GET /media/musics/:musicId          → 302 to a freshly signed playback URL
GET /media/musics/:musicId/cover    → 302 to a freshly signed cover URL
```

- The three services return **these paths** instead of presigned URLs. What the
  player stores never expires, so the whole class of staleness disappears
  rather than being managed.
- The route requires an **authenticated session**, read from the same httpOnly
  cookie as everything else. It is same-origin (ADR 0036), so the `<audio>` and
  `<img>` elements send it without any special handling.
- The signing TTL drops from one hour to **five minutes**. It only has to
  outlive one redirect now, so the window in which a signed URL is useful to
  anyone who captures it shrinks by a factor of twelve.
- Plain REST rather than tRPC, for the same reason the OAuth callback is
  (ADR 0037): the browser navigates these itself, and tRPC is JSON-RPC.

### The API still is not a data path

ADR 0038 deliberately kept bytes out of the server, and that holds. The redirect
carries headers only — the browser then fetches the object **directly from R2**,
including range requests when seeking. What passes through us is the
*addressing*, not the audio.

## Consequences

- **Playback and covers stop expiring**, in every surface at once, with no
  client-side refresh logic anywhere.
- **Media now requires a session.** This is a real tightening, though a narrower
  one than it first appears: `musics.list` returns the whole catalogue to any
  authenticated user, so track access was never scoped to playlist or room
  membership and still is not. What changes is that an **unauthenticated**
  holder of a captured URL no longer gets an hour of access.
- **One extra request per playback start and per seek.** It is a redirect — no
  body, no bytes — but it is a request our API now serves that it did not
  before, and a seek-heavy listener makes several.
- **A client that caches the redirect would pin a signed URL.** The route sends
  `Cache-Control: no-store` so each playback re-authorizes; losing that header
  would quietly reintroduce expiry.
- **R2's range support is now load-bearing through a redirect.** Following a
  302 and re-issuing a `Range` request is ordinary browser behaviour and S3's
  API honours it; our own half is tested against a local object server, but the
  R2 half is inherited from the S3 contract rather than measured here.
- Two more public routes to keep authorized. They are thin, and they are the
  only places left that mint a signed URL for reading.

## Alternatives considered

- **A `musics.playbackUrl` procedure** to re-issue on demand — the fix assumed
  until now. Rejected as symptom management: it leaves the client responsible
  for detecting expiry, preserving playback position across a reload, and
  refreshing covers by a separate path, in every tab and for every participant
  of a room. The redirect removes the need for any of that.

- **A much longer TTL** (a day, a week). One constant, no new routes. Rejected
  because it does not fix a session that outlives the TTL — it only moves the
  boundary — while making a leaked URL useful for far longer, which is the
  opposite of the direction wanted.

- **Proxying the bytes** through the API, which would also give a stable URL.
  Rejected outright: it undoes ADR 0038, putting large audio back through the
  Node process and paying for the transfer twice.

- **A public bucket with unguessable keys.** No signing, no expiry, nothing to
  refresh. Rejected because the only protection would be key secrecy, and the
  keys appear in every page that lists a track.
