# 0013. Persistent left-sidebar shell layout

- Status: Accepted
- Date: 2026-09-06

## Context

The app shell (`Layout.tsx`) was a plain top `<header>` (brand + nav links on
the left, user avatar/name/logout on the right) above a `max-w-3xl` centered
`<main>`, with the persistent player fixed to the bottom. A Spotify-like
frontend needs the classic three-pane shape: a persistent left navigation
sidebar, a full-width scrollable content pane, and the bottom player bar.

## Decision

- Replace the top-nav header with a new `Sidebar` component
  (`src/components/Sidebar.tsx`): a fixed-width (`w-60`) column containing
  the brand mark, primary navigation (`NavLink` to `/`, `/musics`,
  `/playlists`, active-route highlighted, icons from `lucide-react` —
  ADR 0014), and a user block at the bottom (avatar + name, opening a
  `DropdownMenu` with "Log out").
- `Layout.tsx` becomes: `Sidebar` + a `<main>` scroll pane (`flex-1
  overflow-y-auto`, full width, no more `max-w-3xl` centering) side by side,
  with `Player` still fixed to the bottom spanning the full width. The
  existing auth-guard branches (`status === "loading"` spinner,
  `status !== "authenticated"` → redirect to `/login`) are unchanged — only
  the JSX shell below them changed shape.
- No responsive/collapsible sidebar behavior and no resize handle — the
  sidebar is a fixed width with no mobile breakpoint handling in this pass
  (see `memory.md` for this as an open follow-up).
- `LoginPage` (outside the guarded shell) was also restyled to the same dark
  token palette (ADR 0012) for visual consistency, since it's the first
  screen an anonymous visitor sees.

## Consequences

- Establishes the sidebar + main + player three-pane shape as the app's
  navigation convention going forward — new routes are expected to render
  inside the `<main>` pane rather than introduce their own chrome.
- The user menu (logout) moved from an inline header row into a
  `DropdownMenu` off the sidebar's bottom avatar — a small interaction change
  from a single visible "Log out" button to a menu, traded for matching the
  sidebar-bottom-account pattern common to this kind of app shell.
- No mobile/narrow-viewport layout was designed; the sidebar will not adapt
  below its fixed width until a follow-up addresses it.

## Alternatives considered

- **Keep the top-nav bar and only retint it dark**: rejected — doesn't
  deliver the "Spotify clone" structural ask, which is specifically about the
  sidebar-driven navigation shape, not just a color change.
- **A collapsible/resizable sidebar** (matching Spotify's own resize
  behavior): rejected for this pass as scope creep — a fixed-width sidebar
  satisfies the visual/structural goal without the added state management
  and drag-resize interaction work.
