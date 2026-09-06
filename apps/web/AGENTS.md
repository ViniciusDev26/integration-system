# AGENTS.md — web app (`@integration-system/web`)

App-specific operating notes for the web front-end. **Read the repo-wide
[`../../AGENTS.md`](../../AGENTS.md) first** — engineering principles, the ADR +
dependency policy, and the definition of done are repo-wide and apply here too.

## What this app is

A **Vite + React + TypeScript** SPA (ADR 0001) that consumes the API (`apps/api`)
as a JSON API and hosts a persistent, cross-page audio player. The code is still
the trimmed Vite scaffold — the stack below is **decided** (ADRs) but mostly not
implemented yet; add each dependency in the same change as its first use.

## Stack (decided — see [`docs/adrs/`](./docs/adrs/))

- **Vite + React + TypeScript**, client-rendered SPA, **no SSR** (0001).
- **Biome** for lint/format via the shared config (0002) — not ESLint/oxlint.
- **shadcn/ui + Tailwind CSS** for components (0003).
- **react-hook-form + Zod** for forms/validation (0004).
- **Zustand** for client/UI state (e.g. the player) (0005).
- **axios** wrapped in a single **isolated API client** (`src/api/`),
  `withCredentials: true`; components never call axios directly (0006).
- **Auth:** httpOnly session cookie, SPA served **same-origin** by the API
  (dev via Vite proxy `/api`); no SSR. Identity via `GET /api/me` (0007).

Introduce anything beyond these (routing lib, data-fetching/cache, testing setup)
only with a new ADR — same rule as the rest of the repo.

## Conventions in force now

- **Type-safe** TypeScript; the shared Biome base bans `any`, non-null
  assertions, and unsafe casts. Validate untyped boundaries (API responses,
  forms) at runtime with Zod.
- Keep backend calls in the API client module (0006); keep server data out of the
  Zustand stores (0005).

## Commands

From the repo root: `npm run <task> -w @integration-system/web`
(`dev｜build｜preview｜typecheck｜lint｜format`). Or run them inside `apps/web/`.
