# AGENTS.md — web app (`@integration-system/web`)

App-specific operating notes for the web front-end. **Read the repo-wide
[`../../AGENTS.md`](../../AGENTS.md) first** — engineering principles, the ADR +
dependency policy, and the definition of done are repo-wide and apply here too.

## What this app is

A **Vite + React + TypeScript** SPA. Right now it is the **default Vite
scaffold** (trimmed to a clean placeholder). It will consume the API (`apps/api`)
as a JSON API and host a persistent, cross-page audio player.

## Status: front-end decisions pending

No front-end architecture has been chosen yet (routing, data fetching, state, the
player, styling, testing, dev proxy vs. Vite middleware). Do **not** introduce
these without recording an ADR in [`docs/adrs/`](./docs/adrs/) — same rule as the
rest of the repo. Keep the scaffold minimal until those decisions are made.

## Conventions in force now

- **Lint/format: Biome** (shared `@integration-system/biome-config`, web variant)
  via this app's `biome.json` — not ESLint/oxlint. The base bans `any`,
  non-null assertions, and unsafe casts (repo-wide type-safety rule).
- **Type-safe** TypeScript; validate any external/untyped boundary at runtime.

## Commands

From the repo root: `npm run <task> -w @integration-system/web`
(`dev｜build｜preview｜typecheck｜lint｜format`). Or run them inside `apps/web/`.
