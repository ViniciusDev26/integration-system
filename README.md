# Integration System

A sample **music service** (Spotify-like), built as a **Turborepo + npm-workspaces
monorepo**. Authenticated users upload tracks, browse the catalogue, and organize
music into playlists. Audio and cover images live in Cloudflare R2 (uploaded
directly from the browser via presigned URLs); metadata lives in PostgreSQL.

The project is deliberately documentation-driven: every significant decision is
recorded as an ADR, and the operating rules for changing the code live in
[`AGENTS.md`](./AGENTS.md).

---

## AI First

This repository is built to be developed **primarily by AI agents**, with humans
in the loop. The whole workflow is optimized so that any agent (or person) can
pick up the work cold and continue without losing context. The tasks log even
tracks it as a first-class deliverable ("AI-first docs foundation").

The pillars:

- **A single operating manual — [`AGENTS.md`](./AGENTS.md)** (symlinked as
  `CLAUDE.md`). It is the first thing an agent reads: how to reason about the
  code, when to write an ADR, how to keep docs in sync, how to handle
  uncertainty, and the explicit **definition of done**. These rules override
  default agent behavior.
- **Decisions are explicit — ADRs.** No dependency, technology, or architectural
  pattern enters the project without an Architecture Decision Record that
  justifies it (with alternatives considered). Repo-wide ADRs live in
  [`docs/adrs/`](./docs/adrs/); per-app ADRs in `apps/<app>/docs/adrs/`. There
  are already **40+** of them — they are the reasoning trail behind every choice
  in this README.
- **Emergent architecture docs.** Each app's `docs/architecture.md` describes
  what *is* true and decided (the *shape*); the ADRs explain *why*. Docs are
  updated in the **same change** as the code they describe.
- **Working memory — [`memory.md`](./memory.md) + [`tasks.md`](./tasks.md).**
  Volatile cross-session state, discoveries, and open questions live in
  `memory.md`; the actionable task tracker in `tasks.md`. Stable facts get
  *promoted* out of memory into an ADR or the architecture doc.
- **Cross-session handoffs (MCP).** The project uses an `ai-memory` MCP server so
  an agent can hand off state to the next session ("where did we leave off?")
  and query long-term project memory, scoped to this repo.
- **No silent assumptions, TDD by default.** Uncertainty is made visible rather
  than guessed; behavior-bearing code is written test-first (red → green →
  refactor) and must type-check, lint, and pass tests before a task is "done".

If you are an agent working here: **read [`AGENTS.md`](./AGENTS.md) before doing
anything else.**

---

## External integrations

The system talks to three external systems, each isolated behind a typed
**port** with an adapter (and an in-memory fake for tests), so the domain never
depends on a vendor directly.

| System                    | Purpose                                                                 | How it's integrated                                                                                          |
| ------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| **GitHub OAuth**          | User authentication (login) and profile (name, email, avatar)           | Manual OAuth flow — redirect to `github.com/login/oauth`, exchange the code, then read the user from `api.github.com` via an **axios** client behind a `GitHubOAuthClient` port. The callback (`GET /auth/github/callback`) is the one REST route; login start/me/logout are tRPC. |
| **Cloudflare R2**         | Storage for audio files and cover images                                | S3-compatible, accessed with the **AWS S3 v3 SDK** behind an `ObjectStorage` port. Browsers upload **directly to R2 via presigned PUT URLs** and read via presigned GET URLs — the API never proxies the bytes. |
| **PostgreSQL**            | Persistent metadata: users, sessions, musics, playlists, membership      | **Drizzle ORM** (+ Drizzle Kit migrations) over the `postgres.js` driver. Data access is confined to per-entity repositories; UUIDv7 primary keys. |

Configuration for all three is supplied via environment variables — see
[`.env.example`](./.env.example) (`GITHUB_*`, `STORAGE_*`, `DATABASE_URL`).

Related decisions: GitHub OAuth
([0020](./apps/api/docs/adrs/0020-manual-github-oauth.md)), sessions
([0016](./apps/api/docs/adrs/0016-session-httponly-cookie-auth.md),
[0019](./apps/api/docs/adrs/0019-sessions-persisted-in-postgresql.md)), R2
storage ([0007](./apps/api/docs/adrs/0007-r2-object-storage-for-audio-files.md),
[0031](./apps/api/docs/adrs/0031-aws-s3-sdk-object-storage-port.md),
[0038](./apps/api/docs/adrs/0038-presigned-direct-r2-upload.md)), and PostgreSQL
([0008](./apps/api/docs/adrs/0008-postgresql-relational-database.md),
[0013](./apps/api/docs/adrs/0013-drizzle-orm-data-access.md)).

---

## Monorepo layout

| Path                       | What                                                                 |
| -------------------------- | ------------------------------------------------------------------- |
| `apps/api`                 | Node/Express + **tRPC** API (`@integration-system/api`)             |
| `apps/web`                 | Vite + React 19 SPA (`@integration-system/web`)                     |
| `packages/biome-config`    | Shared Biome config (`base` + `api`/`web` variants)                 |
| `docs/adrs/`               | **Repo-wide** ADRs (monorepo, tooling)                              |
| `apps/*/docs/adrs/`        | **Per-app** ADRs                                                     |
| `apps/*/docs/architecture.md` | Per-app architecture, as it emerges                             |
| `memory.md` / `tasks.md`   | Working memory and task log (root, repo-wide)                       |

---

## Tech stack

**API (`apps/api`)**

- **Node.js 24** + **TypeScript** (ESM), **Express** hosting a **tRPC** router
  (end-to-end types, no codegen)
- **PostgreSQL 18** via **Drizzle ORM** + Drizzle Kit migrations (`postgres.js`
  driver, UUIDv7 primary keys)
- **Cloudflare R2** (S3-compatible) for audio/images, via the AWS S3 v3 SDK
  behind an `ObjectStorage` port — **presigned direct-to-R2 uploads** (the API
  never proxies bytes)
- **GitHub OAuth** login with server-side sessions in an httpOnly cookie
  (sessions persisted in PostgreSQL)
- **Zod** runtime validation at every boundary; 100% type-safe (no `any`,
  no escape-hatch casts)
- Feature-modular (`src/modules/*`), ports/adapters wired by hand in a
  composition root, factory functions over classes

**Web (`apps/web`)**

- **Vite** + **React 19** + TypeScript SPA
- **tRPC client** + **TanStack Query** talking to the API same-origin
- **shadcn/ui** + **Tailwind CSS v4**, Radix primitives, `lucide-react` icons
- **Zustand** for client state (auth session, global audio player),
  **React Hook Form** + Zod for forms, **React Router**

**Tooling**

- **Turborepo** task runner over npm workspaces
- **Biome** (shared config) for lint + format
- **Vitest** for tests; **Testcontainers** for repository integration tests
  against real PostgreSQL
- **Docker Compose** for the local dev environment

---

## Getting started

### Prerequisites

- **Node.js 24** (pinned in `.tool-versions`) and **npm ≥ 10**
- **Docker** (for Postgres and repository integration tests)
- A **GitHub OAuth App** and a **Cloudflare R2** bucket (for full functionality)

### 1. Install

```bash
npm install
```

### 2. Configure environment

Copy the example env file and fill in your secrets:

```bash
cp .env.example .env
```

The API needs GitHub OAuth credentials (`GITHUB_CLIENT_ID` /
`GITHUB_CLIENT_SECRET`) and R2 storage credentials (`STORAGE_*`). See
[`.env.example`](./.env.example) for the full list and inline documentation.

### 3. Run

**Option A — full API stack via Docker Compose** (Postgres + migrations + API
with hot reload):

```bash
docker compose up
```

This brings up PostgreSQL, applies Drizzle migrations, and runs the API on
`http://localhost:3000`. After changing dependencies, rebuild with
`docker compose up --build -V`.

**Option B — run apps directly** (bring your own Postgres, or use the `postgres`
compose service):

```bash
# from the repo root — Turbo fans out to every workspace
npm run dev

# or target a single app
npm run dev -w @integration-system/api
npm run dev -w @integration-system/web
```

The web SPA runs on Vite's dev server and talks to the API same-origin.

---

## Common commands

Run from the repo root; Turbo fans out across the workspace. Append
`-w @integration-system/api` (or `/web`) to target a single app.

| Purpose            | Command             |
| ------------------ | ------------------- |
| Type-check         | `npm run typecheck` |
| Lint (Biome)       | `npm run lint`      |
| Format (write)     | `npm run format`    |
| Tests (Vitest)     | `npm test`          |
| Build              | `npm run build`     |
| Dev loop (watch)   | `npm run dev`       |
| Generate migration | `npm run db:generate` |
| Apply migrations   | `npm run db:migrate`  |

Repository integration tests use Testcontainers and require a running Docker
daemon.

---

## Documentation

- **[`AGENTS.md`](./AGENTS.md)** — the operating manual: engineering discipline,
  when to write an ADR, how to use `memory.md`, and the definition of done.
  Read it before making changes.
- **Architecture** — [`apps/api/docs/architecture.md`](./apps/api/docs/architecture.md)
  and the per-app `docs/architecture.md`.
- **Decisions** — repo-wide ADRs in [`docs/adrs/`](./docs/adrs/); per-app ADRs in
  `apps/<app>/docs/adrs/`.
- **Working state** — [`memory.md`](./memory.md) (volatile) and
  [`tasks.md`](./tasks.md).
</content>
</invoke>
