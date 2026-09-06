# 0022. Use Test-Driven Development (TDD) for implementation

- Status: Accepted
- Date: 2026-09-05

## Context

The project values correctness and has a strong testing foundation (Vitest
ADR 0003, repository integration tests via Testcontainers ADR 0015). We want a
disciplined implementation process that keeps the code testable and the test
suite meaningful as features are built (auth, music, playlists).

## Decision

Implement features using **Test-Driven Development**: follow the
**red → green → refactor** cycle — write a failing test that specifies the
desired behavior, write the minimum code to make it pass, then refactor with the
test as a safety net.

- Applies to feature work across layers (services, controllers, repositories).
- **Repositories** are driven by **integration tests against real PostgreSQL via
  Testcontainers** (ADR 0015), matching the Compose Postgres version (ADR 0021).
- Layers above the repository (services, controllers) are driven by **unit
  tests** using fakes/mocks for their dependencies (the repository seam,
  ADR 0014, makes this straightforward).

## Consequences

- Tests are written first and describe intended behavior; coverage is a
  by-product of the process, not an afterthought.
- Design pressure toward small, testable units and clear seams — reinforces the
  Repository pattern (ADR 0014) and feature-modular structure (ADR 0018).
- Slightly slower to write the first line of production code, paid back in
  regression safety and confidence during the future DDD migration.
- This is now part of the **definition of done** (`AGENTS.md`): feature code
  ships with the tests that drove it, and the suite is green.
- Trivial/mechanical changes (config, docs, pure scaffolding) are exempt — TDD
  applies to behavior-bearing code.

## Alternatives considered

- **Test-after:** write code then tests. Faster to start, but tends to produce
  tests that rationalize the implementation and miss edge cases; weaker design
  pressure.
- **No/ad-hoc tests:** unacceptable given the project's correctness goals.
