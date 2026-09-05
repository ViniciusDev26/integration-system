# memory.md

Evolving working memory for this project. This file is a shared scratchpad
across sessions and agents. It is **volatile** — it holds the current state,
discoveries, open questions, and temporary context needed to continue work.

It is **not** a replacement for stable documentation:

- Durable structural knowledge → `docs/architecture.md`
- Decisions with reasoning → `docs/adrs/`

When something here becomes stable or decided, promote it to the right place
and remove it from this file. Keep this file pruned and current.

See `AGENTS.md` for the rules on how to use this file.

---

## Current project state

- The project is in its initial setup phase.
- The AI-first documentation foundation is established (`AGENTS.md`,
  `memory.md`, `docs/architecture.md`, `docs/adrs/`).
- **Foundational stack decided** and recorded as ADRs:
  - Node.js 24 + TypeScript — [ADR 0001](docs/adrs/0001-nodejs-24-and-typescript.md)
  - Express as the HTTP framework — [ADR 0002](docs/adrs/0002-express-http-framework.md)
  - Vitest as the test framework — [ADR 0003](docs/adrs/0003-vitest-test-framework.md)
  - Build with `tsc` + recommended tsconfig base, default compilation —
    [ADR 0004](docs/adrs/0004-build-with-tsc-and-recommended-tsconfig.md)
  - Execution: `tsc` build → `node dist/server.js`; dev loop rebuilds +
    restarts on change. Entry `src/server.ts` → `dist/server.js` —
    [ADR 0005](docs/adrs/0005-execution-and-dev-workflow.md)
  - npm as package manager, exact versions, npm-only —
    [ADR 0006](docs/adrs/0006-npm-package-manager.md)
  - 100% type-safe code, no escape hatches (`any`, unsafe casts, `@ts-ignore`,
    `!`) — [ADR 0009](docs/adrs/0009-strict-type-safety.md); also enforced via
    AGENTS.md §8. Implies strict `tsconfig` + runtime validation at boundaries.
  - Biome as linter/formatter — [ADR 0010](docs/adrs/0010-biome-linter-formatter.md)
  - Zod for runtime validation at boundaries — [ADR 0011](docs/adrs/0011-zod-runtime-validation.md)
  - HTTP input validated via `express-zod-safe` middleware (outside handlers) —
    [ADR 0012](docs/adrs/0012-express-zod-safe-validation-middleware.md)
  - ESM module system (`type: module`, NodeNext, `.js` in relative imports) —
    [ADR 0017](docs/adrs/0017-esm-module-system.md)
  - Feature-modular (vertical slice) layered architecture: `src/modules/<feature>/`
    (routes/controller/service/repository/schema) + `src/shared/` for infra;
    deps point inward — [ADR 0018](docs/adrs/0018-feature-modular-architecture.md)
  - Sessions persisted in PostgreSQL (`sessions` table via session repository) —
    [ADR 0019](docs/adrs/0019-sessions-persisted-in-postgresql.md)
  - GitHub OAuth implemented manually (fetch + Zod, no auth lib), own state/CSRF —
    [ADR 0020](docs/adrs/0020-manual-github-oauth.md)
  - Local Postgres via Docker Compose (`docker compose up -d`) —
    [ADR 0021](docs/adrs/0021-docker-compose-local-database.md)
  - TDD (red → green → refactor) for feature code; repos = Testcontainers
    integration, services/controllers = unit with fakes —
    [ADR 0022](docs/adrs/0022-tdd-methodology.md), also in AGENTS.md §8
  - Production app image: multi-stage `Dockerfile` (Node 24 alpine, non-root,
    /health HEALTHCHECK) — [ADR 0023](docs/adrs/0023-dockerfile-production-image.md).
    Verified: builds, runs, `/health`→200; image ~246MB.
  - DB driver = postgres.js; migrations via Drizzle Kit (`db:generate`/`db:migrate`),
    schema in `src/shared/db/schema/`, migrations in `drizzle/` —
    [ADR 0024](docs/adrs/0024-postgres-driver-and-migrations.md)
  - UUIDv7 PKs via **Postgres 18** native `uuidv7()` (no app uuid lib); session id
    is a random token, not uuidv7 — [ADR 0025](docs/adrs/0025-uuidv7-primary-keys.md).
    Compose + Testcontainers pinned to **postgres:18-alpine** (ADR 0021 updated).
- **Domain decided:** a sample music API, Spotify-like. Serves music metadata
  and playback URLs, with authenticated users.
- **Storage split:** primary database = **PostgreSQL** (relational) for metadata
  (users, playlists, music info), [ADR 0008](docs/adrs/0008-postgresql-relational-database.md);
  object store for audio binaries = **Cloudflare R2** (S3-compatible),
  [ADR 0007](docs/adrs/0007-r2-object-storage-for-audio-files.md).
  DB access via **Drizzle ORM** + Drizzle Kit migrations,
  [ADR 0013](docs/adrs/0013-drizzle-orm-data-access.md), through the
  **Repository pattern** ([ADR 0014](docs/adrs/0014-repository-pattern-data-access.md)) —
  repositories are the only code using Drizzle directly. Rationale: repository
  layer is the integration-test boundary (Testcontainers) and a DDD-ready seam
  (data layer need not map 1:1 to a future domain layer).
- **Repository-layer integration tests via Testcontainers** (real Postgres) —
  [ADR 0015](docs/adrs/0015-testcontainers-repository-integration-tests.md).
- **Scaffolding + first code done.** `package.json` (ESM, engines node>=24,
  `preinstall: only-allow npm`), `tsconfig.json` (NodeNext, strict +
  noUncheckedIndexedAccess), `biome.json`, `.npmrc`, `.tool-versions`.
  Source: `src/app.ts` (`createApp`), `src/server.ts` (listen),
  `src/shared/env.ts` (Zod-validated env). Layout follows ADR 0018
  (feature-modular); feature modules created as features are built. Deps installed: express 5.2.1; dev: typescript, tsc-watch,
  @types/node, @types/express, @biomejs/biome, vitest, zod 4.5.4.
- **Verified working:** `npm run typecheck`, `npm run build`, `npm run lint` all
  pass; server runs and `GET /health` → `200 {"status":"ok"}`, unknown route →
  404. supertest not installed yet (planned).
- npm-only enforcement now complete: `engines` + `preinstall: only-allow npm` in
  package.json back the `.npmrc` `engine-strict` (ADR 0006 follow-up done).

## Implementation roadmap

Build under the current feature-modular architecture (ADR 0018):

1. **Auth: GitHub social login (OAuth).** First feature. Authenticated state =
   server-side session via httpOnly cookie, not JWT ([ADR 0016](docs/adrs/0016-session-httponly-cookie-auth.md)).
2. **Music registration** ("cadastrar músicas") — create music metadata + upload
   the audio file to R2 (ADR 0007). First write feature.
3. **`GET /musics/:id`** — music information + URL to listen (presigned R2 URL).
4. **`GET /playlist`** — list available playlists.

Then, when playlists start getting complex (e.g. **shared/collaborative
playlists** with real invariants), **reassess the architecture and plan the
migration toward hexagonal/DDD** per module — see "Architecture plan" below.

Base server + health check are in place; feature work starts at step 1.
Core entities: users, playlists, musics, playlist↔music (many-to-many).

## Architecture plan (DDD migration)

- **User's goal:** train DDD on this project — this is an explicit intent, not
  just a possible future.
- **Agreed plan:** keep the pragmatic feature-modular/layered architecture
  (ADR 0018) for auth + music registration + music retrieval, where the domain
  is CRUD-ish (would be anemic under DDD now).
- **Migration trigger:** when the **playlist** feature gains real complexity
  (shared/collaborative playlists with invariants), revisit and migrate toward
  **hexagonal + DDD**, incrementally and per module (extract repository
  interfaces as ports, ORM/HTTP become adapters). ADR 0014/0018 kept this seam
  cheap. At that point supersede/extend ADR 0018 with a new architecture ADR.
- This is a deliberate "adopt DDD when a rich domain appears" plan — see
  ADR 0018 alternatives/triggers.

## Important discoveries

- **Local Node default is v22 (mise), but the project requires Node 24** (ADR
  0001) and `engine-strict` blocks installs on older Node. Node 24.18.0 was
  already installed via mise; pinned it in `.tool-versions`. Run tooling with
  Node 24 active (`mise use node@24` / mise auto-activation in this dir).
- **Arctic (OAuth lib) was deprecated July 2026**, along with the Lucia/Oslo
  ecosystem (same author now recommends copy-paste over the lib). This is why
  GitHub OAuth is implemented manually (ADR 0020), not via Arctic.

## Open questions

- Note (ADR 0010): Biome does not do full type-aware linting, so type-aware
  "unsafe-*" checks rely on strict `tsconfig` + code review, not the linter.
- Env config: chosen `PUBLIC_BASE_URL` (host only); callback is derived in code
  as `${PUBLIC_BASE_URL}/auth/github/callback`. Documented in `.env.example`
  (PORT, NODE_ENV, PUBLIC_BASE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET,
  DATABASE_URL). User has filled their local `.env`. Still TODO: add these vars
  to the Zod schema in `shared/env.ts` when implementing auth/DB (currently
  env.ts only validates PORT + NODE_ENV).
- Session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- What architecture and boundaries are appropriate as features are added?

## Temporary context

- _(none yet)_
