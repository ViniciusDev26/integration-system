# 0010. Global auth/session state in a Zustand store

- Status: Accepted
- Date: 2026-09-06

## Context

Login/logout should be driven by **global application state** (not scattered
query hooks), and login needs a visible **in-progress indicator**. Auth/session
is app-global identity + status, distinct from the list data (musics/playlists)
that TanStack Query owns (ADR 0008).

## Decision

Make a **Zustand store** (`useAuthStore`, realizing ADR 0005) the single source
of auth state and the home for login/logout:

- State: `user` and `status` (`loading` → initial check; `authenticating` →
  login started/redirecting; `authenticated`; `anonymous`).
- Actions: `fetchMe()` (called once on app load and after returning from OAuth),
  `login()` (sets `authenticating`, then redirects to the GitHub URL from
  `auth.startLogin`), `logout()`.
- The store calls a **standalone (vanilla) tRPC client** (`createTRPCClient<AppRouter>`,
  `src/api/client.ts`) so actions run outside React while staying fully typed. The
  React client (Providers) and this one share one link config (`src/api/links.ts`).
- The `authenticating` status drives a **spinner** on the login button.

Server **data** (musics/playlists) stays in TanStack Query (ADR 0008); this store
holds only the session/identity.

## Consequences

- One global place components read for auth and call `login`/`logout`; clear login
  progress UX.
- A deliberate **exception** to "server data lives in Query, not Zustand"
  (ADR 0008): identity/session is treated as app-global state. The user object is
  fetched via the standalone client and cached in the store (refreshed on load /
  after login / on logout), not via a `useQuery`.
- Two tRPC clients (React + vanilla) coexist, sharing the link config.

## Alternatives considered

- **Auth via TanStack Query (`auth.me` hook) + a local pending flag:** simplest
  and consistent with ADR 0008, but the login/logout control isn't a global store
  (the explicit requirement), and progress state is per-component.
- **React Context for auth:** works, but re-renders broadly and duplicates what
  Zustand already gives us here.
