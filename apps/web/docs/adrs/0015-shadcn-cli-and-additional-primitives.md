# 0015. Adopt the shadcn CLI; add avatar, dropdown-menu, card, scroll-area, separator, badge

- Status: Accepted
- Date: 2026-09-06

## Context

ADR 0003 chose shadcn/ui + Tailwind, describing components as "generated via
the shadcn CLI," but in practice the 3 components that existed
(`button`, `slider`, `spinner`) were hand-authored in a shadcn-like style with
no `components.json` and no CLI ever run. The Spotify-style redesign needs
several more primitives with real interaction logic (an accessible dropdown
menu for the sidebar's user menu, in particular) that are worth generating
properly rather than hand-rolling.

## Decision

- Actually run the shadcn CLI: `npx shadcn@latest init` (template `vite`,
  base `radix`, preset `nova`), creating `components.json` for the first time
  and requiring a `@/*` path alias (added to `tsconfig.json`,
  `tsconfig.app.json`, and `vite.config.ts`'s `resolve.alias`, since none
  existed — the app previously used only relative imports).
- Add `avatar`, `dropdown-menu`, `card`, `scroll-area`, `separator`, `badge`
  via `npx shadcn@latest add`, used respectively for: user/track/playlist
  avatars with fallbacks (replacing raw `<img>`/emoji placeholders), the
  sidebar's user menu, playlist/quick-link tiles, (available for future use,
  not yet consumed), visual dividers, and genre tags.
- This CLI run brought in its own dependency set, which supersedes what
  ADR 0003 anticipated:
  - **`radix-ui`** — a single meta-package re-exporting all `@radix-ui/react-*`
    primitives (`Avatar`, `DropdownMenu`, `Slot`, …), used by every generated
    component instead of installing one `@radix-ui/react-*` package per
    primitive.
  - **`shadcn`** — the CLI's own runtime package; its `shadcn/tailwind.css`
    export supplies shared infrastructure the generated components depend on
    (the `data-open`/`data-closed`/`data-checked`/… custom variants used for
    Radix state-based styling, plus small utilities like `no-scrollbar`).
  - **`class-variance-authority` (CVA)** — already anticipated by ADR 0003 but
    never actually installed until now; used by the generated `button.tsx`
    and `badge.tsx` for variant/size composition.
  - **`cn`** — a small package providing the `cn()` class-merging helper
    (clsx + tailwind-merge behavior in one). `src/lib/utils.ts` now
    re-exports it (`export { cn } from "cn"`) instead of hand-implementing it
    with the `clsx`/`tailwind-merge` packages.
  - **`tw-animate-css`** — Tailwind v4-compatible `animate-in`/`animate-out`
    utilities, needed by the `data-open`/`data-closed`-driven open/close
    transitions in `dropdown-menu.tsx` and similar components.
- Dropped **`clsx`** and **`tailwind-merge`** as direct dependencies — nothing
  in the codebase imports them anymore now that `cn` supersedes both.
- Dropped **`@fontsource-variable/geist`**, which the CLI's `nova` preset
  installed to self-host the Geist font — this app doesn't adopt a Geist
  branding identity, so `--font-sans`/`--font-heading` in `index.css` were
  pointed back at the existing system-font stack and the dependency removed.

## Consequences

- `components.json` now exists and is the real source of truth for how
  future `shadcn add` runs will generate files in this repo — ADR 0003's
  "generated via the shadcn CLI" description is now actually true.
- The generated `button.tsx` gained a larger variant/size surface
  (`default`/`outline`/`secondary`/`ghost`/`destructive`/`link` ×
  `default`/`xs`/`sm`/`lg`/`icon`/…) than the original hand-written
  `primary`/`secondary` — a superset, so the one existing call site
  (`variant="secondary"`) kept working unchanged.
- One more path alias (`@/*`) exists in the project; new shadcn-generated
  files use it, hand-written files may keep using relative imports (both
  resolve identically).

## Alternatives considered

- **Keep hand-authoring components in the existing minimal style**: rejected
  for primitives with real composition/accessibility logic worth not
  reimplementing (`dropdown-menu` in particular manages focus, portals, and
  positioning) — but this is a one-time-per-component-set decision, not a
  ban on ever hand-writing a small component again.
- **Install per-primitive `@radix-ui/react-*` packages** (as ADR 0003
  originally implied) instead of the `radix-ui` meta-package: not viable
  once `shadcn add` was used as the generation path — it targets `radix-ui`
  imports by default, and fighting that on every future `add` would mean
  permanently diverging from what the CLI generates.
