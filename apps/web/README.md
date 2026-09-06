# @integration-system/web

The browser front-end for Spotifake — a **Vite + React + TypeScript** SPA. It
lives in the monorepo (`apps/web`) and will consume the API (`apps/api`) as a
JSON API, hosting a persistent cross-page audio player.

> **Status:** default Vite scaffold, trimmed to a clean placeholder. Front-end
> architecture (routing, data fetching, state, the player, styling, testing, dev
> proxy) is **not decided yet** — record decisions as ADRs in
> [`docs/adrs/`](./docs/adrs/) before introducing them. See
> [`AGENTS.md`](./AGENTS.md) and the repo-wide [`../../AGENTS.md`](../../AGENTS.md).

## Commands

Run from the repo root (Turbo), or scope to this app with `-w`:

```bash
npm run dev       -w @integration-system/web   # Vite dev server
npm run build     -w @integration-system/web   # tsc -b && vite build
npm run preview   -w @integration-system/web   # preview the build
npm run typecheck -w @integration-system/web   # tsc -b
npm run lint      -w @integration-system/web   # Biome
npm run format    -w @integration-system/web   # Biome (write)
```

## Tooling

- **Lint/format: Biome** via the shared `@integration-system/biome-config` (web
  variant) — not ESLint/Oxlint. The shared base bans `any`, non-null assertions,
  and unsafe casts (repo-wide type-safety rule).
- **TypeScript** project references (`tsconfig.app.json` + `tsconfig.node.json`).
