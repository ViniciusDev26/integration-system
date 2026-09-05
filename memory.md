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
- `.npmrc` exists (`save-exact=true`, `engine-strict=true`). No other
  scaffolding yet — no `package.json`, `tsconfig.json`, or application code.

## Implementation roadmap

Ordered plan (not yet implemented — no code by decision):

1. **Auth: GitHub social login (OAuth).** First feature. Authenticated state =
   server-side session via httpOnly cookie, not JWT ([ADR 0016](docs/adrs/0016-session-httponly-cookie-auth.md)).
2. **`GET /playlist`** — list available playlists.
3. **`GET /musics/:id`** — music information + URL to listen (URL served from R2,
   likely a presigned URL).

Expected core entities: users, playlists, musics, and a playlist↔music
relationship (many-to-many). To be modeled once the database type is chosen.

## Important discoveries

- _(none yet)_

## Open questions

- Note (ADR 0010): Biome does not do full type-aware linting, so type-aware
  "unsafe-*" checks rely on strict `tsconfig` + code review, not the linter.
- Testing strategy for **service and handler layers** (unit with fake repos, or
  broader integration/e2e — possibly Testcontainers too). Only the repository
  layer is decided (ADR 0015); the rest is open.
- **Session store** (ADR 0016): where server-side sessions are persisted —
  PostgreSQL (already in stack) vs Redis vs in-memory? Not yet decided.
- GitHub OAuth implementation details: app registration, callback URL, CSRF
  mitigation for cookie auth, and the OAuth/session middleware to use
  (follow-up once auth work starts).
- Stack details still not decided:
  - Module system: ESM or CommonJS? (currently defaulting to the recommended
    tsconfig / `tsc` defaults per ADR 0004; revisit if a specific one is needed)
- Follow-up when scaffolding is created: complete npm-only enforcement in
  `package.json` — add an `engines` field and an npm-only guard (e.g.
  `preinstall: "npx only-allow npm"` and/or `"packageManager": "npm@<version>"`)
  to back up the `engine-strict=true` in `.npmrc` (ADR 0006).
- What architecture and boundaries are appropriate once the domain is known?

## Temporary context

- _(none yet)_
