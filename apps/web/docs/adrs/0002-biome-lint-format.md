# 0002. Biome for lint + format (shared config)

- Status: Accepted
- Date: 2026-09-06

## Context

The Vite `react-ts` scaffold shipped with **Oxlint** (`.oxlintrc.json`). The
monorepo already standardizes on **Biome** for lint + format via a shared config
package (`@integration-system/biome-config`, root ADR 0002); the API app uses it.
Two linters across two apps would fragment the toolchain.

## Decision

Use **Biome** for `apps/web`, via the shared config's **web variant**. This
app's `biome.json` composes `[base, biome.web.json]` (relative-path `extends` —
Biome 2.5.12's `extends` is non-recursive and doesn't resolve package subpaths,
see root ADR 0002). The web variant adds `.tsx` to the lint/format globs; the
base bans `any`, non-null assertions, and unsafe casts (repo-wide type safety).
The scaffold's `.oxlintrc.json` and the `oxlint` dependency are removed.

## Consequences

- One formatter/linter and one rule source of truth across the monorepo; a single
  Biome binary at the root.
- `npm run lint｜format -w @integration-system/web` (or via Turbo at the root).
- React-specific lint rules are not enabled yet; add them in the web variant if a
  need arises (a follow-up, not a new tool).

## Alternatives considered

- **ESLint (typescript-eslint + plugins):** the React default and richer plugin
  ecosystem, but a second toolchain to configure/maintain; Biome is faster and
  already chosen repo-wide.
- **Oxlint (Vite default):** fast, lint-only (no formatter), and yet another tool;
  dropped for consistency with the monorepo's Biome standard.
