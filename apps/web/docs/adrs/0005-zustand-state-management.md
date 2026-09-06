# 0005. Zustand for client state

- Status: Accepted
- Date: 2026-09-06

## Context

Some state is genuinely global and outlives individual routes — most notably the
**persistent audio player** (current track, play/pause, position, and later a
queue), plus lightweight UI/session state. React Context alone re-renders broadly
and gets unwieldy as this grows.

## Decision

Use **Zustand** for cross-cutting **client/UI state** (the player store first).

- Small stores with selector-based subscriptions (components re-render only on the
  slices they read).
- Scope: client state only. **Server data** (musics, playlists) is fetched through
  the API client (ADR 0006); if server-cache needs grow, a dedicated data-fetching
  layer (e.g. TanStack Query) can be added later via its own ADR — Zustand is not
  a server cache.

## Consequences

- Minimal boilerplate vs. Redux; no provider tree required.
- Clear home for the player state that must survive navigation (ADR 0001).
- Discipline needed to keep server data out of global stores (avoid stale caches).

## Alternatives considered

- **Redux Toolkit:** robust and structured, but more boilerplate than this app
  needs.
- **React Context + useReducer:** no dependency, but broad re-renders and awkward
  for frequently-updating state like playback position.
- **Jotai / Valtio:** fine atom/proxy models; Zustand's store model was preferred
  for the player.
