# 0003. shadcn/ui + Tailwind CSS for components

- Status: Accepted
- Date: 2026-09-06

## Context

The SPA needs a UI component set (buttons, forms, dialogs, menus, etc.) that is
accessible, consistent, and themeable (light/dark), without adopting a heavy
runtime component framework we can't easily restyle.

## Decision

Use **shadcn/ui**: accessible components built on **Radix UI** primitives and
**Tailwind CSS**, generated into the repo (owned code, not a black-box
dependency) and composed with **class-variance-authority** + `tailwind-merge` +
`clsx`. This implies adopting **Tailwind CSS** as the styling system for the app.

- Components are added on demand via the shadcn CLI and live under the app's
  `src/` (e.g. `src/components/ui/*`) — we own and can edit them.
- Tailwind is configured for Vite; theme tokens (incl. dark mode) live in the
  Tailwind/CSS config.

## Consequences

- Full control over component markup/styles; no fighting a library's theme API.
- Tailwind becomes the styling convention; utility classes in components.
- Radix brings accessible behavior (focus, keyboard, ARIA) for free.
- Adds Tailwind + Radix + CVA to the dependency graph (justified here per the
  dependency-ADR rule); the generated components are code we maintain.

## Alternatives considered

- **MUI / Chakra / Mantine:** batteries-included runtime libraries, but heavier,
  opinionated theming, and less markup control than owning the components.
- **Radix primitives alone:** the accessible base, but we'd re-build the styled
  layer shadcn/ui already provides.
- **Plain CSS / CSS Modules, hand-rolled components:** maximum control, most work;
  loses the accessible, ready-made set.
