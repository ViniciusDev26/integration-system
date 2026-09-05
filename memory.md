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

Pending work is tracked as a checklist in [`tasks.md`](tasks.md).

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
  - Factory functions (closures) over classes for repos/services/controllers —
    [ADR 0026](docs/adrs/0026-factory-functions-over-classes.md)
  - DI via ports (interfaces) + adapter factories + manual composition root,
    no DI container (TS interfaces are erased at runtime; containers need
    tokens+classes+reflect-metadata) — [ADR 0027](docs/adrs/0027-di-ports-adapters-manual-composition-root.md)
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
  404. supertest now installed and used for controller tests. Real server boots
  against the compose Postgres and `GET /auth/github` → 302 to real GitHub with
  correct `client_id`/`redirect_uri`/`scope`/`state` + httpOnly state cookie;
  callback 400 (missing params) / 401 (bad state) confirmed. Full OAuth `code`
  exchange requires a browser login (+ migration applied) — manual, not automated.
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

Base server + health check are in place. Done so far: `users`/`sessions` schema
+ migration; **`UserRepository`** as a **port** (`user.repository.ts`) with a
Postgres adapter factory `createPostgresUserRepository` (`user.repository.postgres.ts`)
— `findById`/`findByGithubId`/`upsertByGithubId`, built TDD, 6 integration tests
green via Testcontainers (PG18). **`SessionRepository`** likewise: port
(`src/modules/sessions/session.repository.ts`) + `createPostgresSessionRepository`
adapter — `create`/`findById`/`deleteById`, 5 integration tests green (incl. FK
cascade on user delete). **`SessionService`** done (TDD, unit): `createForUser`
(random 256-bit token via node crypto, TTL default 30d), `validate` (deletes +
returns null when expired), `revoke`. Injectable `now`/`generateToken`/`ttlMs`
for deterministic tests; 7 tests green using `createInMemorySessionRepository`
(fake colocated as `*.in-memory.ts`, excluded from build). Style: closures +
ports/adapters + manual composition root (ADR 0026/0027). Full suite: 18 green.
**`GitHubOAuthClient`** done (`src/modules/auth/`): port (`github-oauth.client.ts`,
`GitHubUser`) + http adapter `createGitHubOAuthClient` (`github-oauth.client.http.ts`)
with injectable `fetch` + Zod-validated responses — `getAuthorizationUrl`,
`exchangeCodeForToken`, `getAuthenticatedUser` (resolves primary verified email
via `/user` then `/user/emails`; email guaranteed non-null). Uses **axios**
(ADR 0028) via an injected `AxiosInstance`; 6 unit tests inject an axios instance
with a fake native `adapter` (no network, no axios-mock-adapter — that lib's
types clashed with axios 1.20). Full suite: 24 green.
- Note: a full real-GitHub OAuth E2E is NOT automatable (authorization-code grant
  needs a human browser login for the `code`). If more confidence is wanted:
  local mock-server integration test (real axios over localhost; would need
  injectable base URLs) or a PAT-gated smoke test for `getAuthenticatedUser`.
**`authService`** done (`src/modules/auth/auth.service.ts`, TDD unit): `getLoginUrl()`
→ `{ url, state }` (random CSRF state via node crypto, injectable); `handleCallback({
code, state, expectedState })` → verify state (throws on mismatch/empty),
exchange code, fetch GitHub user, upsert via UserRepository, create session via
SessionService. 5 unit tests with fakes (`createFakeGitHubOAuthClient`,
`createInMemoryUserRepository`, real SessionService over in-memory session repo).
Fakes colocated as `*.fake.ts` / `*.in-memory.ts`, excluded from build. Full
suite: 29 green.
**Login wired end to end (HTTP layer + composition).** Done:
- `src/shared/env.ts` now also validates `DATABASE_URL` (z.url), `PUBLIC_BASE_URL`
  (z.url, trailing slash stripped via transform), `GITHUB_CLIENT_ID`,
  `GITHUB_CLIENT_SECRET`.
- `src/shared/db/index.ts` — prod DB client: `getDb()` (lazy postgres.js + Drizzle
  from `env.DATABASE_URL`) + `closeDb()`. Only the composition root resolves it.
- `src/container.ts` — `createContainer()` wires `db → repos → services →
  authService` with prod adapters (ADR 0027).
- `src/modules/auth/auth.controller.ts` + `auth.routes.ts` + `.constants.ts` +
  `.types.ts`. Routes: `GET /auth/github` (302 + `oauth_state` httpOnly cookie,
  10 min), `GET /auth/github/callback` (`express-zod-safe` validates code+state,
  ADR 0012; checks `oauth_state` cookie → 401 on mismatch/missing; sets `session`
  httpOnly cookie, ADR 0016; redirects `/`), `POST /auth/logout` (revoke + clear).
  Cookies: HttpOnly + SameSite=Lax; Secure when NODE_ENV=production.
- `src/app.ts` — now `createApp({ authController })`; adds `cookie-parser`, mounts
  `/auth`. `src/server.ts` builds the container + controller then listens.
- Controller built TDD via **supertest** (`auth.controller.test.ts`, 7 tests).
  Full suite: **36 green**. typecheck/lint/build clean.
- New deps (exact, ADR 0006): `express-zod-safe` 3.2.1, `cookie-parser` 1.4.7;
  dev: `supertest` 7.2.2, `@types/supertest`, `@types/cookie-parser`.
Core entities still to model: playlists, musics, playlist↔music (many-to-many).

**Server-rendered UI added (ADR 0030), branded "Spotifake".** Handlebars via
`express-handlebars` 9.0.1:
- View engine wired in `src/app.ts` (`engine({defaultLayout:"main"})`, views =
  `path.join(import.meta.dirname,"views")` — resolves to `src/views` under Vitest
  and `dist/views` when compiled). Templates: `src/views/layouts/main.handlebars`
  (inline CSS, Spotify-green accent, light/dark) + `src/views/home.handlebars`.
- Build copies templates: `copy:views` script (`cp -r src/views/. dist/views/`);
  `build` and `dev` (onSuccess) run it. Prod image ships `dist/views`.
- `src/modules/web/` slice: `web.controller.ts` (`home` reads session cookie →
  `authService.getCurrentUser` → view model `{displayName,email,imageUrl}` or
  null) + `web.routes.ts` (`GET /`). Wired in container/server (webController).
- Added `authService.getCurrentUser(sessionId)` (TDD, 3 unit tests): validate
  session → `userRepository.findById`. New `AuthService` method.
- Extracted shared `readCookie` → `src/shared/http/cookies.ts` (Zod-validated),
  now used by both auth + web controllers (removed the dup in auth.controller).
- **Behavior change:** `POST /auth/logout` now redirects `303 → /` (was 204) so a
  browser form lands on home; login callback already redirects `→ /`. Constant
  `POST_LOGOUT_REDIRECT_PATH`. Updated auth.controller tests accordingly.
- `web.controller.test.ts` (supertest over the REAL Handlebars engine, 3 tests):
  signed-out (sign-in link, no "Log out"), signed-in (name/email/logout form),
  invalid cookie → signed out. Full suite: **42 green**.
- Removed `api.http` (user pivoted to the UI instead).
- New deps (exact): `express-handlebars` 9.0.1.
- Fixed latent prod bug: `Dockerfile` build stage copied only `tsconfig.json`,
  but `npm run build` uses `tsconfig.build.json` (added to the COPY). Verified
  the production image builds and ships `dist/views`.
- **Compose node_modules: named → anonymous volume.** Adding express-handlebars
  broke `docker compose up` (`Cannot find module 'express-handlebars'`): the
  container used a NAMED node_modules volume seeded once from an older image, so
  new deps were missing. Switched `/app/node_modules` to an anonymous volume →
  after any dep change run `docker compose up --build -V` (`-V` renews anon
  volumes, keeps `pgdata`). Removed the top-level `node_modules:` named volume.
- **Fixed dev script.** `tsc-watch --onSuccess` runs its command via cross-spawn
  WITHOUT a shell, so `&&` in onSuccess is passed as literal args (broke
  `copy:views && node`). Now `copy:views` runs ONCE before tsc-watch in the `dev`
  script (`npm run copy:views && tsc-watch ... --onSuccess "node dist/server.js"`);
  `dist/views` persists across recompiles so once is enough. Verified: app builds
  + serves `GET /` (Spotifake) in-container with a fresh `-V` volume.

Auth controller decisions (consequences of accepted ADRs, no new ADR):
- CSRF `state` kept in a short-lived httpOnly `oauth_state` cookie; verified at
  the HTTP layer (401) AND re-checked in `authService.handleCallback` (defense in
  depth). Cookie names: `oauth_state`, `session`.
- `express-zod-safe` typed handler seam: share the query schema
  (`githubCallbackSchema`, exported from `auth.controller.ts`) between `validate()`
  and the handler typed via its `ValidatedRequest<typeof schema>` — no casts.
- Untyped inbound cookies (`req.cookies` is `any`) are validated with a Zod
  `z.record(z.string(), z.string()).catch({})` at the read boundary.
- Follow-up: the callback maps only state-mismatch to 401; other failures (bad
  `code`, GitHub/DB errors) bubble to Express's default 500. Introduce typed auth
  errors → proper 4xx/5xx mapping when it matters.

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
- **Testcontainers hung on this machine (WSL2)** resolving the Docker host to the
  bridge gateway `172.17.0.1` (Reaper/container connections unreachable). Fix:
  `TESTCONTAINERS_HOST_OVERRIDE=localhost`, set (with `??=`) in `startTestDatabase`
  (`src/container-test.ts`). With it, containers start in ~1.5s and Ryuk
  works. Docker must be running to run repository tests.
- **`docker-compose.yml` was broken for postgres:18.** The volume mounted at
  `/var/lib/postgresql/data`; PG18 images now store data in a subdirectory of the
  mount and reject a fresh init when mounted at `.../data` (container crash-loops,
  "in 18+, these Docker images are configured to store database data in ..."). Fix:
  mount `pgdata` at `/var/lib/postgresql`. `docker compose up -d` now goes healthy.
- **Local run needs Node 24 active** (default shell node is v22 here); npm blocks
  installs/scripts otherwise (`engine-strict`). Use `mise exec -- <cmd>` (or
  `mise use node@24`) so npm/tsc/vitest run under 24.18.0.
- **TypeScript is 7.0.2 — the native (Go) compiler**, not TS 5.x. Its `tsc
  --watch` exposes no `watchFile`/`watchOptions`/`TSC_WATCHFILE` polling knobs
  (help lists only `--watch`). Consequence: in-container `tsc-watch` hot reload
  does NOT see host edits over the **Docker Desktop + WSL2** bind mount, even
  though the file content + mtime DO propagate (verified via `stat` in the
  container) — the watcher just never wakes. No tsconfig/env polling config fixes
  it. Works on native Docker (Linux) where inotify crosses the mount. Fallback
  for WSL2: `docker compose restart app`, or host `npm run dev` (native WSL2 ext4
  fs events work) with only Postgres in Compose. Full dev env = ADR 0029.
- **Server does not auto-load `.env`.** `npm start`/`dev` don't pass `--env-file`;
  only `db:migrate` uses `--env-file-if-exists=.env`. To run the server against
  the local DB, provide env (e.g. `node --env-file=.env dist/server.js` with
  `DATABASE_URL` also set). User's `.env` currently lacks `DATABASE_URL` — it must
  be added (see `.env.example`) for the server/migration to run.

## Open questions

- Note (ADR 0010): Biome does not do full type-aware linting, so type-aware
  "unsafe-*" checks rely on strict `tsconfig` + code review, not the linter.
- Env config: `PUBLIC_BASE_URL` (host only); callback derived in code as
  `${PUBLIC_BASE_URL}/auth/github/callback` (in `container.ts`). All vars now in
  the Zod schema (`shared/env.ts`): NODE_ENV, PORT, DATABASE_URL, PUBLIC_BASE_URL,
  GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET. **Resolved.** Note: user's local `.env`
  still needs `DATABASE_URL` added (see discoveries).
- **GitHub OAuth callback includes an `iss` param** (RFC 9207, issuer
  identification) beyond `code`/`state`. express-zod-safe wraps a raw-shape query
  in `z.strictObject`, which 400-ed on the extra key. Fixed: `githubCallbackSchema.query`
  is now a `z.object` (strips unknown keys). Hardening follow-up: actually
  validate `iss === "https://github.com"` (RFC 9207 mix-up defense) instead of
  discarding it.
- Session cleanup/expiry strategy for the `sessions` table (ADR 0019).
- What architecture and boundaries are appropriate as features are added?

## Temporary context

- _(none yet)_
