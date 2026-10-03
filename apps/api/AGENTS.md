# AGENTS.md — API app (`@integration-system/api`)

App-specific operating notes for the API. **Read the repo-wide
[`../../AGENTS.md`](../../AGENTS.md) first** — it holds the engineering
principles, documentation rules, the ADR + dependency policy, the
technology-specific rules (§8), and the definition of done (§9). This file only
adds what is specific to `apps/api`.

## What this app is

A Node 24 / TypeScript **tRPC API** (ADR 0037) for the `apps/web` SPA, backed by
PostgreSQL (Drizzle) and R2 object storage; uploads go **directly to R2 via
presigned URLs** (ADR 0038). Express hosts the tRPC middleware (`/trpc`) + the
GitHub OAuth redirect flow (`/auth`) and serves the SPA build same-origin. **No
SSR** (ADR 0030 superseded). Feature-modular under `src/modules/*`, ports/adapters
wired in a manual composition root (`src/container.ts`); the tRPC layer is in
`src/trpc/` and per-feature `*.router.ts`. See `docs/architecture.md`.

## Where things live

- Code: `src/` (modules in `src/modules/`, shared in `src/shared/`). Modules with
  more than one concern group files into responsibility sub-modules — `oauth/`,
  `service/`, `repository/`, `http/` (ADR 0018).
- **A module with real invariants splits `domain/` from `application/`**
  (ADR 0046). `domain/` is pure: no `await` on a port, no framework or ORM
  types, and `now` arrives as an argument — so its tests use no fakes at all.
  `application/` orchestrates: load through ports, ask the domain, write,
  publish, and map outcomes to typed errors. The test is *"can it be decided
  from the data in hand plus a timestamp, without awaiting anything?"* — if yes
  it is domain. Modules without such a rule (`media/`, `users/`) stay flat; an
  empty domain layer is worse than none. Done: `invite/`, `room/`. The clearest
  example of the shape is `room/domain/room.playback.ts`.
- **In a module taken further (ADR 0047), the domain model is not the table.**
  Value objects are branded types with a validating constructor — the brand is
  type-level only, so they cross Drizzle and tRPC unchanged, which is what lets
  the web import and call `room/domain` on wire data. The repository maps
  row ↔ entity, and the router returns a DTO. A **rule** returns an outcome; a
  **constructor** throws, because invalid data means corruption. Done:
  `invite/` (entity, `InviteToken`, mapper, DTOs).
- **A room advances through its queue on listener reports, not a timer**
  (ADR 0048): the server has no track durations, so `rooms.trackEnded` carries
  the `musicId` and `advancePlayback` writes
  `WHERE current_music_id = ?`. That compare-and-swap is what makes N
  simultaneous reports advance the room once — the domain check alone does not
  survive concurrency.
- Decisions: [`docs/adrs/`](./docs/adrs/) (0001–00NN). Architecture:
  [`docs/architecture.md`](./docs/architecture.md).
- DB migrations: `drizzle/` (schema in `src/shared/db/schema/`).
- Tests: co-located `*.test.ts`; the test composition root + Testcontainers
  bootstrap is `src/container-test.ts` (not `src/test-support/`).
- Local ops: `scripts/` (git-ignored — seed + audio/thumbnail downloads).

## Commands

From the repo root: `npm run <task> -w @integration-system/api`
(`typecheck｜lint｜format｜test｜build｜start｜dev`). Or, inside `apps/api/`,
`npm run <task>` directly. Lint/format use the shared Biome config
(`@integration-system/biome-config`) via this app's `biome.json`.

- Migrations need `DATABASE_URL` in the environment (no `--env-file`):
  `DATABASE_URL=postgres://user:password@localhost:5432/integration_system npm run db:migrate`.
- Repository tests need a Docker daemon (Testcontainers). Local dev DB + app run
  via the root `docker compose` (ADR 0021/0029).
