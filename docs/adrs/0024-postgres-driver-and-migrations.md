# 0024. Database connection: postgres.js driver + Drizzle Kit migrations

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0013 chose Drizzle ORM but left the concrete Postgres driver and the
migration workflow unspecified. We need a driver for the Node runtime and a
schema-evolution mechanism.

## Decision

- **Driver:** `postgres` (postgres.js). Drizzle connects via
  `drizzle-orm/postgres-js`.
- **Migrations:** **Drizzle Kit** — `drizzle-kit generate` produces SQL
  migrations from the TypeScript schema into `drizzle/`; `drizzle-kit migrate`
  applies them. Exposed as `npm run db:generate` / `db:migrate`.
- **Schema location:** `src/shared/db/schema/` (one file per table +
  `index.ts` barrel), the single source of truth referenced by
  `drizzle.config.ts`. Consistent with the feature-modular layout (ADR 0018):
  `users`/`sessions` are cross-cutting and live in `shared/db`.
- `.env` is loaded for `db:migrate` via Node's `--env-file-if-exists=.env` flag
  (no extra dependency, no error when the file is absent); `db:generate` needs no
  connection. `drizzle.config.ts` just reads `process.env.DATABASE_URL`.

## Consequences

- postgres.js is TypeScript-native and ESM-first (ADR 0017), so no `@types`
  package is needed — fits the 100% type-safety goal (ADR 0009).
- Migrations are versioned SQL files committed to the repo (`drizzle/`), giving a
  reviewable, reproducible schema history; applied in dev, CI, and (later) prod.
- Connections are lazy (postgres.js connects on first query), so importing the
  db client does not fail when the database is down.
- The runtime db client (`src/shared/db`) and the `DATABASE_URL` entry in
  `shared/env.ts` are added when the first repository uses them (per the
  "validate env where used" rule).

## Alternatives considered

- **node-postgres (`pg`) + `@types/pg`:** the most ubiquitous driver, but needs a
  separate types package and is less ESM-native than postgres.js. A valid
  fallback if a postgres.js-specific limitation appears.
- **Hand-written SQL migrations / another migration tool:** redundant given
  Drizzle Kit generates migrations directly from the typed schema.
