# AGENTS.md — web app (`@integration-system/web`)

App-specific operating notes for the web front-end. **Read the repo-wide
[`../../AGENTS.md`](../../AGENTS.md) first** — engineering principles, the ADR +
dependency policy, and the definition of done are repo-wide and apply here too.

## What this app is

A **Vite + React + TypeScript** SPA (ADR 0001) that consumes the API (`apps/api`)
over **tRPC** and hosts a persistent, cross-page audio player. The foundation,
screens, and player are implemented; the UI follows a Spotify-like dark,
sidebar-driven visual identity (see below).

## Stack (decided — see [`docs/adrs/`](./docs/adrs/))

- **Vite + React + TypeScript**, client-rendered SPA, **no SSR** (0001).
- **Biome** for lint/format via the shared config (0002) — not ESLint/oxlint.
- **shadcn/ui + Tailwind CSS** for components (0003), generated via the real
  shadcn CLI (`components.json`, 0015) — `npx shadcn@latest add <name>` to add
  more. **`lucide-react`** for icons (0014, shadcn's default icon library).
- **react-hook-form + Zod** for forms/validation (0004).
- **Zustand** for client/UI state (e.g. the player) (0005) — *not* for server list
  data. The **global auth/session store** lives here too (0010).
- **tRPC client + TanStack Query** (0008, supersedes the axios ADR 0006): one
  typed client in `src/api/` importing `AppRouter` from
  `@integration-system/api/trpc`; `httpBatchLink` → `/trpc` with
  `credentials: "include"`. Components use the generated hooks, never `fetch`/axios
  directly (except the presigned-`PUT` upload).
- **Auth:** httpOnly session cookie, same-origin (dev via Vite proxy `/trpc` +
  `/auth`); no SSR. Managed by the **global auth store** (0010): `status`
  (loading/authenticating/authenticated/anonymous) + `login`/`logout`/`fetchMe`
  via a standalone tRPC client; login shows a spinner. The OAuth callback is REST
  at `/auth/github/callback` (0007).
- **Routing:** React Router (0009) — a persistent, **auth-guarded** layout route
  (`<Outlet/>`): anonymous visitors are redirected to `/login` (a public route),
  the initial session check shows a spinner. The shell hosts the sidebar + player.
- **Uploads:** presigned direct-to-R2 (api ADR 0038) — `musics.prepareUpload` →
  `PUT` to the URL → `musics.create`.
- **Player (0011):** one hidden `<audio>` in the app shell + `usePlayerStore`
  (Zustand); playback happens **only** through it — no inline `<audio>` on pages.
- **Theme & shell:** a single always-dark palette via Tailwind v4 tokens in
  `index.css` (0012, no light mode); a persistent left `Sidebar` (nav + user
  menu) replaces the old top-nav header as the app's navigation convention
  (0013).

Structure: `src/api/` (tRPC client + Providers), `src/pages/` (routed screens),
`src/components/` (`Layout`, `Sidebar`, `player/`, `ui/`), `src/store/`
(Zustand: auth, player), `src/lib/`. Introduce anything new (e.g. a testing
setup) only with a new ADR.

## Conventions in force now

- **Type-safe** TypeScript; the shared Biome base bans `any`, non-null
  assertions, and unsafe casts. Validate untyped boundaries at runtime with Zod.
- Keep backend calls in the `src/api/` tRPC client (0008); keep server data in
  TanStack Query, not the Zustand stores (0005).

## Commands

From the repo root: `npm run <task> -w @integration-system/web`
(`dev｜build｜preview｜typecheck｜lint｜format`). Or run them inside `apps/web/`.
