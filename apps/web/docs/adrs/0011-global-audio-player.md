# 0011. Global audio player — a single `<audio>` driven by a Zustand queue

- Status: Accepted
- Date: 2026-09-06

## Context

The SPA needs an audio player that **persists across navigation** and is the
**only** way audio plays (no inline players on list pages). It must play a single
track or a whole playlist, with cover art, play/pause, previous/next, seek,
volume, and repeat (playlist or current track).

shadcn/ui has no audio-player component (it's a component library), so we build a
headless one from its primitives (Slider) + the HTML5 `<audio>` element.

## Decision

- A **player store** (`usePlayerStore`, Zustand — ADR 0005) holds the `queue`,
  `index`, `isPlaying`, `volume`, `currentTime`, `duration`, and `repeat`
  (`off | all | one`), with actions (`playTrack`, `playQueue`, `toggle`,
  `next`/`previous`, `trackEnded`, `seek` via the component, `setVolume`,
  `cycleRepeat`).
- **One hidden `<audio>` element** lives in the app shell (`Layout` → `Player`),
  so it survives route changes. The `Player` component syncs the store to the
  element imperatively (load `src`, play/pause, volume) and maps element events
  (`timeupdate`/`loadedmetadata`/`ended`) back to the store. On `ended` it
  advances per `repeat` (`one` replays in place).
- A **fixed control bar** (cover, title/genres, transport, a shadcn/Radix
  **Slider** for seek + volume, repeat toggle) renders when a track is loaded.
- **Playback only via the player:** list/detail pages have **no inline
  `<audio>`** — each track has a "Play" button that calls the store. On
  `/musics`, Play queues that single track; on a playlist, "Play" queues the whole
  playlist (and a track's Play starts the playlist from there).

## Consequences

- Audio keeps playing while navigating; one source of truth for playback.
- Repeat covers "playlist" (`all`) and "current track" (`one`); `off` stops at the
  end of the queue.
- **Presigned playback URLs expire (~1h, api ADR 0031).** A long session could hit
  an expired URL. **Follow-up:** a `musics.playbackUrl` procedure to refresh a
  single URL on demand (or re-fetch the list) — deferred.

## Alternatives considered

- **Inline `<audio controls>` per track (previous SSR behavior):** simplest, but
  playback stops on navigation and violates "only via the player."
- **A ready-made player library (react-h5-audio-player, etc.):** faster, but a
  heavier dependency and less control than a small store + `<audio>`.
- **Range inputs instead of the shadcn Slider:** dependency-free, but we chose the
  shadcn/Radix Slider for consistency (ADR 0003).
