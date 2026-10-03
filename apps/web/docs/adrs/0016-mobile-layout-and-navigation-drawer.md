# 0016. Mobile layout, with navigation in a drawer

- Status: Accepted
- Date: 2026-10-02
- Extends: [0013](./0013-sidebar-shell-layout.md)

## Context

ADR 0013 chose a persistent left sidebar and said plainly what it was leaving
out: *"No mobile/narrow-viewport layout was designed; the sidebar will not adapt
below its fixed width until a follow-up addresses it."* This is that follow-up.

The sidebar is `w-60` — 240px — and always rendered. On a 375px phone it takes
two thirds of the width before any content is drawn, which is not a degraded
experience so much as an unusable one.

Everything else was in better shape than expected: the card grids already carry
`sm:`/`md:`/`lg:` breakpoints. What actually breaks is the shell, the player
bar, and a handful of rows that assume horizontal room.

## Decision

### Navigation moves into a drawer below `md`, not a bottom bar

- The sidebar becomes `hidden md:flex`.
- Below `md`, a slim top bar carries the brand, a menu button and the user
  menu; the menu button opens a left drawer with the same navigation.

A bottom tab bar is the more common phone pattern and was rejected for a
concrete reason: **the player already owns the bottom edge** and is
`fixed inset-x-0 bottom-0`. Stacking a nav above it would spend two horizontal
bands of vertical space on exactly the screens that have least, or require the
player to move — a larger change to the feature ADR 0011 established.

The navigation items live in one module used by both, so the two cannot drift.

### The drawer is a Radix `Dialog`, not hand-rolled

`radix-ui` is already a dependency (the avatar and dropdown menu use it) and
exports `Dialog`, so the drawer gets focus trapping, escape handling, scroll
locking and `aria-modal` **without a new dependency and without hand-rolling
accessibility**. This respects ADR 0015's preference for real primitives over
bespoke ones while needing no `shadcn add`.

### The player bar wraps into two rows below `sm`, and sheds volume

The bar's three columns — track, transport, volume — do not fit on one 390px
row. The first attempt kept them side by side and the track title collapsed to
a single letter and an ellipsis, which the screenshots caught. So below `sm` the
bar wraps: the track and the queue toggle share the first row, and the transport
plus the seek take a full-width second one. `sm:flex-nowrap` restores the
single-row desktop bar unchanged.

The volume control is hidden below `sm` — it duplicates the hardware volume on a
phone. Transport, the seek bar and the queue toggle all stay: they have no
hardware equivalent. The shell's bottom padding grows to match the taller bar.

### Content adapts rather than scrolls sideways

- Detail headers stack below `sm` and their cover art shrinks.
- Forms that were `flex items-end` become column-first, so a `select` gets the
  full width instead of being squeezed beside its button.
- The shell's horizontal padding drops from `px-6` to `px-4` on small screens.

The rule applied throughout: **the page body never scrolls horizontally**; wide
content either wraps, stacks, or scrolls inside its own container.

## Consequences

- **The app is usable on a phone**, which it was not.
- **Two navigation surfaces to keep in step.** Sharing the item list is what
  keeps that honest; adding a destination means editing one array.
- **The drawer adds markup to every authenticated screen**, though it is inert
  above `md`.
- **Volume is unreachable on a phone** from within the app. Accepted: the
  device has a volume control, and the alternative was cramming a slider into a
  bar that already holds transport and a seek.
- **The player bar is taller on a phone** (two rows), which costs vertical
  space. Accepted: the alternative was an unreadable title. Its position and
  behaviour are unchanged, so ADR 0011 stands untouched — the bottom bar is
  still the one place playback happens.
- **Verified by screenshot, not by assertion.** `apps/web` still has no test
  framework, so this was checked by driving a headless Chromium over CDP against
  the running app with a real session: every route at 390px, 360px and 1280px,
  the drawer open, and the player bar with a track loaded. The probe asserted
  `scrollWidth - clientWidth === 0` per route — zero everywhere — and named any
  element wider than the viewport when it was not. The 1280px pass is the
  regression check that nothing above `md` moved. None of this is repeatable in
  CI; the missing test framework is pre-existing and recorded in `memory.md`.

## Alternatives considered

- **A bottom tab bar.** The conventional phone pattern. Rejected because the
  player already occupies the bottom edge; two stacked bars would cost scarce
  vertical space, and moving the player would reopen ADR 0011.

- **A collapsible rail** (icons only below `md`). Keeps navigation always
  visible and needs no overlay. Rejected because even a 64px rail is a sixth of
  a 375px screen, permanently, to show what a drawer shows on demand.

- **`shadcn add sheet`**, the idiomatic route under ADR 0015. Rejected only
  because it was unnecessary: the underlying Radix `Dialog` is already present,
  so adding the wrapper would have added a dependency for styling we write
  either way.

- **Leaving it.** ADR 0013 deliberately deferred this, and deferring again
  would have been defensible if nothing depended on it. Rooms changed that: a
  listening session with chat is something people join from a phone.
