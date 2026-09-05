# 0027. Dependency injection: ports + adapters + manual composition root

- Status: Accepted
- Date: 2026-09-05

## Context

We want dependencies to be swappable by "interface" — e.g. a Postgres user
repository in production and an in-memory one in tests. A key TypeScript fact
constrains the options: **interfaces are erased at runtime**, so no container
can resolve by the actual interface type; they all use **tokens** (symbols/
strings/classes) that stand in for it. The token-based containers that feel most
like interface DI (tsyringe, InversifyJS) require **classes + decorators +
`reflect-metadata`**, which conflicts with the functional style (ADR 0026) and
the no-runtime-magic, 100%-type-safe stance (ADR 0009).

## Decision

Do dependency injection **manually**, using **ports and adapters**:

- Define each collaborator as a **port** — a TypeScript `interface`
  (e.g. `UserRepository`).
- Provide **adapters** as factory functions (ADR 0026):
  `createPostgresUserRepository(db): UserRepository` (production),
  `createInMemoryUserRepository(): UserRepository` (tests/fakes).
- Wire the object graph by hand in a single **composition root** (a
  `src/container.ts` / bootstrap module), injecting the production adapters.
  Tests construct the graph with fakes instead.

No DI container/library.

## Consequences

- **Swap by interface, checked at compile time:** any factory returning the port
  type is substitutable (structural typing) — the Postgres/in-memory swap the
  user asked for, with zero runtime magic and full type safety (ADR 0009).
- The dependency graph is **explicit in one place**, easy to read and trace.
- Establishes **ports** now, which is exactly the seam the future hexagonal/DDD
  migration needs (ADR 0018) — this is a step in that direction, not a detour.
- Testing stays consistent: Postgres adapters are integration-tested with
  Testcontainers (ADR 0015); in-memory adapters are the fakes that power service
  **unit** tests (ADR 0022).
- **Cost:** wiring is manual, so as the graph grows the composition root does
  too. Acceptable at this scale; if it becomes unwieldy we can revisit a
  closure-friendly container (e.g. Awilix) without changing the factories.

## Alternatives considered

- **tsyringe / InversifyJS:** token-based DI that feels interface-driven, but
  needs classes + decorators + `reflect-metadata` — reverses ADR 0026 and adds
  runtime magic.
- **Awilix:** works with factory functions (no classes), but resolves by
  parameter **name** (stringly-typed), weakening type safety (ADR 0009).
- **Service locator / global singletons:** hides dependencies and hurts
  testability; rejected.
