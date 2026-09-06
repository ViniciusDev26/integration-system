# 0009. Client-side routing with React Router

- Status: Accepted
- Date: 2026-09-06

## Context

The SPA (ADR 0001) has several screens (login/home, musics, upload, playlists,
playlist detail) and needs client-side routing so navigation doesn't reload the
document — which is also what lets a persistent audio player survive navigation
(the app shell stays mounted while the routed content swaps).

## Decision

Use **React Router** (`react-router-dom`) with a `BrowserRouter`, a persistent
**layout route** (app shell → `<Outlet/>`) and child routes:

- `/` — home (signed-in nav, or a "Sign in with GitHub" action).
- `/musics`, `/musics/new` — list + upload.
- `/playlists`, `/playlists/new`, `/playlists/:id` — list, create, detail.

The layout route hosts shared chrome (nav and, later, the persistent player);
only the `<Outlet/>` content changes on navigation.

## Consequences

- Standard, well-documented routing; declarative routes; the shell persists.
- Adds `react-router-dom` (justified here).
- SPA fallback on the server (api ADR 0036) serves `index.html` for these client
  paths so deep links work.

## Alternatives considered

- **TanStack Router:** type-safe routing that pairs with TanStack Query, but a
  newer/heavier choice; React Router is the mainstream default and enough here.
- **Hand-rolled routing (History API):** no dependency, but re-implements nested
  layouts, params, and links.
