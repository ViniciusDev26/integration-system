# @integration-system/web

The browser front-end for Spotifake — a **Vite + React + TypeScript** SPA. It
lives in the monorepo (`apps/web`) and will consume the API (`apps/api`) as a
JSON API, hosting a persistent cross-page audio player.

> **Status:** the stack is **decided** ([`docs/adrs/`](./docs/adrs/)) but the code
> is still the trimmed Vite scaffold — implementation follows. See
> [`AGENTS.md`](./AGENTS.md) and the repo-wide [`../../AGENTS.md`](../../AGENTS.md).

## Stack (see `docs/adrs/`)

- Vite + React + TypeScript SPA, no SSR (0001)
- Biome lint/format via the shared config (0002)
- shadcn/ui + Tailwind CSS (0003)
- react-hook-form + Zod (0004)
- Zustand for client state (0005)
- axios in an isolated API client, `withCredentials` (0006)
- httpOnly session cookie, served same-origin by the API; identity via
  `GET /api/me` (0007)

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
