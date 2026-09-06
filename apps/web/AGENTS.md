# AGENTS.md — web app (`@integration-system/web`)

App-specific operating notes for the web front-end. **Read the repo-wide
[`../../AGENTS.md`](../../AGENTS.md) first** — engineering principles, the ADR +
dependency policy, and the definition of done are repo-wide and apply here too.

## What this app is

A **Vite + React + TypeScript** SPA (ADR 0001) that consumes the API (`apps/api`)
over **tRPC** and hosts a persistent, cross-page audio player. The code is still
the trimmed Vite scaffold — the stack below is **decided** (ADRs) but mostly not
implemented yet; add each dependency in the same change as its first use.

## Stack (decided — see [`docs/adrs/`](./docs/adrs/))

- **Vite + React + TypeScript**, client-rendered SPA, **no SSR** (0001).
- **Biome** for lint/format via the shared config (0002) — not ESLint/oxlint.
- **shadcn/ui + Tailwind CSS** for components (0003).
- **react-hook-form + Zod** for forms/validation (0004).
- **Zustand** for client/UI state (e.g. the player) (0005) — *not* for server data.
- **tRPC client + TanStack Query** (0008, supersedes the axios ADR 0006): one
  typed client in `src/api/` importing `AppRouter` from
  `@integration-system/api/trpc`; `httpBatchLink` → `/trpc` with
  `credentials: "include"`. Components use the generated hooks, never `fetch`/axios
  directly (except the presigned-`PUT` upload).
- **Auth:** httpOnly session cookie, same-origin (dev via Vite proxy `/trpc` +
  `/auth`); no SSR. Identity via the `auth.me` procedure; login via the
  `/auth/github` redirect (0007).
- **Uploads:** presigned direct-to-R2 (api ADR 0038) — `musics.prepareUpload` →
  `PUT` to the URL → `musics.create`.

Introduce anything beyond these (routing lib, testing setup) only with a new ADR.

## Conventions in force now

- **Type-safe** TypeScript; the shared Biome base bans `any`, non-null
  assertions, and unsafe casts. Validate untyped boundaries at runtime with Zod.
- Keep backend calls in the `src/api/` tRPC client (0008); keep server data in
  TanStack Query, not the Zustand stores (0005).

## Commands

From the repo root: `npm run <task> -w @integration-system/web`
(`dev｜build｜preview｜typecheck｜lint｜format`). Or run them inside `apps/web/`.
