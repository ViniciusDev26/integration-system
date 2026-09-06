# AGENTS.md — API app (`@integration-system/api`)

App-specific operating notes for the API. **Read the repo-wide
[`../../AGENTS.md`](../../AGENTS.md) first** — it holds the engineering
principles, documentation rules, the ADR + dependency policy, the
technology-specific rules (§8), and the definition of done (§9). This file only
adds what is specific to `apps/api`.

## What this app is

A Node 24 / TypeScript / Express HTTP app (server-rendered UI via Handlebars,
plus the beginnings of a JSON surface) backed by PostgreSQL (Drizzle) and R2
object storage. Feature-modular under `src/modules/*`, ports/adapters wired in a
manual composition root (`src/container.ts`).

## Where things live

- Code: `src/` (modules in `src/modules/`, shared in `src/shared/`).
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
