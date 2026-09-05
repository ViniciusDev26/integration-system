# 0014. Use the Repository pattern for database access

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0013 chose Drizzle ORM for PostgreSQL. We still need to decide how the rest
of the application interacts with the database: call Drizzle directly from
handlers/services, or route all data access through a dedicated abstraction.
Calling the ORM directly from many places spreads persistence concerns and
couples business logic to Drizzle specifics.

Two concrete goals motivate isolating data access behind repositories:

1. **Integration-test boundary.** Database integration tests (Testcontainers +
   a real PostgreSQL, ADR 0015) target the **repository layer** specifically.
   Having a single, well-defined data-access seam makes those tests focused and
   meaningful.
2. **Future DDD flexibility.** If the project later adopts DDD, the data layer
   should be free to diverge from the domain layer — repositories need not map
   **1:1** to domain models. The repository seam preserves that freedom instead
   of leaking persistence shapes into business logic.

## Decision

Access the database exclusively through the **Repository pattern**. Each
aggregate/entity (e.g. users, playlists, musics) has a repository that exposes
intention-revealing methods (e.g. `findPlaylistById`, `listPlaylists`,
`getMusicById`). Repositories are the **only** code that uses Drizzle directly;
services/handlers depend on repositories, not on Drizzle.

## Consequences

- **Separation of concerns:** business logic is isolated from persistence
  details; Drizzle usage is confined to the repository layer.
- **Testability:** the repository layer is the integration-test boundary
  (Testcontainers, ADR 0015); upper layers can substitute repositories with
  fakes/mocks in unit tests (Vitest, ADR 0003) without a real database.
- **DDD-ready seam:** the data layer can evolve independently of a future domain
  layer (no forced 1:1 mapping).
- **Consistency:** query construction lives in one place per entity, reducing
  duplication and drift.
- **Type safety preserved:** repositories return Drizzle-typed entities (or
  explicit domain types), keeping ADR 0009 intact — no casting leaks to callers.
- **Trade-off / cost:** adds an abstraction layer over an already-typed ORM.
  To avoid a leaky/anemic wrapper, repositories should expose meaningful
  operations rather than blindly proxying Drizzle. Keep them thin; do not
  reintroduce a generic query builder on top of Drizzle.
- Repository interfaces and their Drizzle-backed implementations will be created
  during implementation; structure/naming conventions to be documented in
  `docs/architecture.md` as they solidify.

## Alternatives considered

- **Call Drizzle directly in services/handlers:** less code, but couples
  business logic to the ORM and hurts testability and consistency.
- **Full DAO / Unit-of-Work / generic repository abstraction:** more machinery
  than this sample API needs; risks over-engineering. A focused per-entity
  repository is the pragmatic middle ground.
