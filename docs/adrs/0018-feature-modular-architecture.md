# 0018. Feature-modular (vertical slice) layered architecture

- Status: Accepted
- Date: 2026-09-05

## Context

The system needs an overall architecture. Prior decisions already established
layering primitives — Repository pattern (ADR 0014), services/handlers, Zod
validation at the HTTP boundary (ADR 0012), and infrastructure isolated behind
seams (Drizzle ADR 0013, R2 ADR 0007). The domain is small and well-defined
(auth, playlists, musics) but should scale cleanly as features are added, and
we want to preserve a DDD-ready seam without adopting full DDD now.

The options weighed were: (a) classic layering organized by technical type,
(b) feature-modular / vertical slice, (c) Clean/Hexagonal ports & adapters.

## Decision

Adopt a **layered architecture organized by feature (vertical slices)**.

- Each feature lives under `src/modules/<feature>/` and contains its own layers:
  `*.routes.ts`, `*.controller.ts`, `*.service.ts`, `*.repository.ts`,
  `*.schema.ts` (Zod).
- Cross-cutting/infrastructure code lives under `src/shared/`: `db/` (Drizzle
  client + schema), `r2/` (S3 client), `env.ts`, `middleware/`, `errors/`.
- `src/app.ts` (composition of module routes) and `src/server.ts` (bootstrap)
  stay at the source root.
- **Dependency direction points inward:** controllers depend on services,
  services on repositories; Express, Drizzle, and R2 are edge concerns. Business
  logic does not import framework/ORM types directly (those stay in
  controllers/repositories).

### Module boundaries

- Modules communicate through **services/public entry points**, never by
  reaching into another module's repository or internals.
- `shared/` is for genuinely cross-cutting concerns only — it must not become a
  dumping ground; feature-specific code stays in its module.

## Planned revisit (DDD)

Training DDD is an explicit project goal. Rather than adopt it prematurely on a
CRUD-ish domain (which would yield an anemic model), the agreed plan is:

- Build **auth**, **music registration**, and **music retrieval** under this
  architecture.
- When the **playlist** feature grows real invariants (e.g. **shared /
  collaborative playlists**), **reassess and migrate toward hexagonal + DDD**
  incrementally, per module — extracting repository interfaces as ports and
  turning the ORM/HTTP into adapters. A new architecture ADR will then
  supersede or extend this one. The inward-pointing dependencies and repository
  seam here are specifically what keep that migration cheap.

## Consequences

- **Cohesion:** everything for a feature is in one place; easy to navigate and
  to reason about a change's blast radius.
- **Scalability:** new features are new folders, not edits spread across many
  by-type directories.
- **Testability & DDD-ready:** the repository seam per module preserves the
  integration-test boundary (ADR 0015) and lets the data layer diverge from a
  future domain layer without a rewrite.
- **Discipline required:** cross-module coupling and a bloated `shared/` are the
  main risks; guarded by the boundary rules above and code review.
- Modules are created **as features are implemented** (no empty speculative
  module folders). Existing code is aligned to this layout incrementally
  (starting by moving `env.ts` into `shared/`).

## Alternatives considered

- **Layered by technical type** (`routes/`, `services/`, ...): familiar and
  simple, but scatters a single feature across many folders as the app grows.
- **Clean/Hexagonal (ports & adapters):** maximal decoupling via explicit
  domain/application/infrastructure split and port interfaces, but more
  boilerplate and indirection than this sample API warrants now. The chosen
  approach keeps a compatible direction (inward dependencies, infra at edges),
  so a later move toward hexagonal/DDD per-module remains feasible.
