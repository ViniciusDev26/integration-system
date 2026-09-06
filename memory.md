# memory.md

Evolving working memory for this project — a **volatile** scratchpad across
sessions/agents: current state, discoveries, open questions, temporary context.

It is **not** a replacement for stable documentation:

- Durable structural knowledge → each app's `docs/architecture.md`
  (e.g. [`apps/api/docs/architecture.md`](apps/api/docs/architecture.md)).
- Decisions with reasoning → ADRs: repo-wide in [`docs/adrs/`](docs/adrs/),
  per-app in `apps/*/docs/adrs/`.

When something here becomes stable or decided, promote it to the right place and
remove it from this file. Keep it pruned. See root `AGENTS.md` §5 for the rules.

> **Monorepo (2026-09-06):** repo is now Turborepo + npm workspaces
> (`docs/adrs/0001`): API in `apps/api`, Vite React scaffold in `apps/web`,
> shared Biome config in `packages/biome-config` (`docs/adrs/0002`). Run tasks
> from the root via turbo (`npm run build｜lint｜typecheck｜test｜dev`) or per app
> with `-w @integration-system/api｜web`. **Migrations** need `DATABASE_URL` in the
> env (no `--env-file`): e.g.
> `DATABASE_URL=postgres://user:password@localhost:5432/integration_system npm run db:migrate`.
> Seed script: `apps/api/scripts/` (git-ignored; from repo root:
> `node --env-file=.env apps/api/scripts/seed-musics.mjs`).

---

Pending work is tracked in [`tasks.md`](tasks.md).

## Current state

- **`apps/api` is a tRPC API** (ADR 0037; details in
  [`apps/api/docs/architecture.md`](apps/api/docs/architecture.md)): GitHub OAuth
  (only the **callback** is REST, `/auth/github/callback`) + server-side sessions;
  tRPC procedures `auth.startLogin`/`auth.me`/`auth.logout`,
  `musics.list`/`prepareUpload`/`create`,
  `playlists.list`/`create`/`get`/`addMusic`; `AppRouter` type exported for the
  web. **music**: multiple `genres` (`text[]`), optional thumbnail, **presigned
  direct-to-R2 upload** (ADR 0038 — `ObjectStorage.getUploadUrl`; `register` kept
  server-side for the seed). **playlists**: relational membership
  (`playlist_members` OWNER|MEMBER) with membership authz. Migrations `0000`–`0005`.
- **SSR removed** (ADR 0030 superseded by 0036) and **multer removed** (0032
  superseded by 0038): no `web` module / Handlebars / `requireAuth` middleware.
  The app serves `apps/web/dist` same-origin (guarded — inert until built).
- **`apps/web` SPA is built** (Fase 2): Vite + React + TS, Tailwind v4, React
  Router (ADR 0009), tRPC client + TanStack Query (`src/api/`, importing
  `AppRouter` from `@integration-system/api/trpc`, `credentials: "include"`), forms
  with react-hook-form + Zod. Screens: home/login, musics list, upload (presigned
  direct-to-R2), playlists list/new/detail. The API serves `apps/web/dist`
  same-origin (verified: `/` + deep links 200, `/trpc/auth.me` anon → 401).
- **Next:** the **persistent audio player** (plan with the user) — Zustand store
  (ADR 0005) + a component in the app shell that survives navigation.
- **User's DB state:** compose Postgres is migrated through `0004`; **`0005`
  (playlists) still needs applying** before playlists work against a live DB.

## DDD migration plan (intent)

The user wants to practice **DDD** on this project. Agreed plan: keep the
pragmatic feature-modular/layered architecture (ADR 0018) while the domain is
CRUD-ish; when **playlists** gain real invariants (shared/collaborative), revisit
and migrate toward **hexagonal + DDD** per module (repository ports already make
this seam cheap) and supersede ADR 0018 with a new architecture ADR. Tracked in
`tasks.md` → "Later".

## Important discoveries (still operationally relevant)

- **Node 24 required** (ADR 0001) + `engine-strict` blocks older Node. Local mise
  default may be v22; Node 24.18.0 is pinned in `.tool-versions` (ADR 0035). Run
  tooling with Node 24 active (`mise use node@24` / auto-activation), or
  `mise exec -- <cmd>`.
- **Testcontainers hung on WSL2** resolving the Docker host to the bridge gateway
  `172.17.0.1`. Fix: `TESTCONTAINERS_HOST_OVERRIDE=localhost`, set (with `??=`) in
  `startTestDatabase` (`apps/api/src/container-test.ts`). Docker must be running
  for repository tests.
- **PG18 volume mount:** postgres:18 stores data in a subdirectory of the mount
  and crash-loops if mounted at `/var/lib/postgresql/data`. Compose mounts `pgdata`
  at `/var/lib/postgresql` (already fixed).
- **WSL2 + Docker Desktop + native TS7 `tsc-watch`** doesn't see host edits over
  the bind mount (no polling knobs in the Go compiler). Fallback: `docker compose
  restart app`, or run `npm run dev -w @integration-system/api` on the host with
  only Postgres in Compose.
- **Env is not auto-loaded.** The server/migrations read env from the process, not
  a `.env` by default. Run the server with `node --env-file=.env apps/api/dist/server.js`
  (+ `DATABASE_URL`); migrations need `DATABASE_URL` in the env (see the banner).
  Root `.env` carries `GITHUB_*` + `STORAGE_*` + `PUBLIC_BASE_URL`; it needs a
  `DATABASE_URL` too for host runs (compose provides it in-container).

## Open questions / follow-ups

- Session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- Validate the GitHub callback `iss` param (RFC 9207) instead of stripping it.
- Docker **container build not re-validated** after the monorepo change — a
  `docker compose up --build` pass is recommended.
- Biome 2.5.12 `extends` is non-recursive and won't resolve package subpaths — the
  shared config is referenced by relative path (see `docs/adrs/0002`).

## Temporary context

- _(none)_
