# 0015. Use Testcontainers for repository-layer integration tests

- Status: Accepted
- Date: 2026-09-05

## Context

The Repository pattern (ADR 0014) isolates all database access behind a single
seam. We want database integration tests that exercise real SQL against a real
PostgreSQL — not mocks — to catch schema/query issues that unit tests cannot.
Vitest is the test framework (ADR 0003) and Drizzle is the ORM (ADR 0013).

## Decision

Use **Testcontainers** to run **integration tests against a real PostgreSQL**
instance, scoped to the **repository layer**. Repository tests spin up a
disposable PostgreSQL container, apply the Drizzle schema/migrations, exercise
the repository methods, and tear the container down.

## Consequences

- High-fidelity data-access tests: real Postgres behavior (constraints, SQL,
  types) is verified, not simulated.
- The repository layer is the well-defined target for these tests, reinforcing
  why data access is isolated there (ADR 0014).
- Requires a container runtime (e.g. Docker) available in local and CI
  environments; integration tests are slower than unit tests, so they will
  likely be organized/separable from the fast unit suite (naming/scripts TBD).
- Migrations must be applied to the fresh container before tests run; the
  Drizzle Kit workflow (ADR 0013) supports this.

## Scope / open

- This ADR covers **repository-layer** integration tests only. The testing
  strategy for the **service and handler layers** (unit with fake repositories,
  or broader integration/e2e — possibly also via Testcontainers) is **not yet
  decided** and is tracked in `memory.md`.

## Alternatives considered

- **Mock/in-memory the database:** fast, but does not validate real SQL, schema
  constraints, or Drizzle-generated queries — defeats the purpose of the tests.
- **Shared long-lived test database:** simpler to start, but causes test
  cross-contamination and environment drift; disposable containers are isolated
  and reproducible.
- **SQLite as a stand-in for Postgres in tests:** faster, but dialect
  differences make it an unfaithful substitute for production PostgreSQL.
