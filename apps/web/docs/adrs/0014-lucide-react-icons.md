# 0014. `lucide-react` for icons

- Status: Accepted
- Date: 2026-09-06

## Context

The player controls and app chrome used raw emoji as icons (⏮️⏸️▶️⏭️🔁🔂🔊☰✕).
For a modern, Spotify-like look, these need to become real vector icons —
consistent stroke weight/size across all of them, not subject to the emoji
font installed on a given OS.

## Decision

Adopt **`lucide-react`** as the icon library, replacing every emoji glyph in
`Player.tsx` and used for the new `Sidebar.tsx` nav/user-menu icons and
per-page icons (track/playlist placeholders, upload, etc.).

- It's the icon set shadcn/ui's own CLI (ADR 0015) generates code against by
  default (`components.json`'s `"iconLibrary": "lucide"`), so adopting it
  keeps one icon idiom across hand-written and CLI-generated components
  instead of mixing two.
- Tree-shakeable (each icon is its own module; only imported icons ship).
- No runtime font/CSS loading (unlike an icon-font approach) and no
  dependency on the OS's emoji font, unlike the code it replaces.

## Consequences

- One new runtime dependency (`lucide-react`).
- Icons are now consistent in weight/size everywhere, sized via Tailwind
  (`h-4 w-4`, etc.) instead of relying on emoji glyph metrics.

## Alternatives considered

- **`@radix-ui/react-icons`**: a smaller, less actively maintained icon
  package, and stylistically inconsistent with the `lucide` set shadcn's own
  generated components (`dropdown-menu.tsx`'s `ChevronRightIcon`/`CheckIcon`)
  already pull in.
- **`react-icons`**: bundles many icon families with inconsistent visual
  styles; heavier, and picking "the right family" per icon adds more
  decision surface than a single coherent set.
- **Hand-drawn inline SVGs**: zero new dependency, but more manual work to
  keep ~12+ icons visually consistent (stroke width, corner radius), and
  would diverge from the icon idiom the shadcn CLI already assumes for any
  future `shadcn add`.
