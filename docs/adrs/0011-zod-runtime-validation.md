# 0011. Use Zod for runtime validation at boundaries

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0009 (100% type safety) requires validating external/untyped boundaries at
runtime — HTTP request bodies and params, database rows where applicable, R2
responses, and environment variables — so values become safely typed without
casting. A validation library is needed.

## Decision

Use **Zod** as the runtime validation library. Define schemas at each boundary
and derive TypeScript types from them (`z.infer`) so the runtime shape and the
static type stay in sync from a single source of truth.

## Consequences

- External input is parsed and validated at the edge; downstream code receives
  correctly-typed values without `as` casts, satisfying ADR 0009.
- Types are inferred from schemas, avoiding drift between validation and types.
- Adds a dependency and a small amount of parsing overhead at boundaries — an
  acceptable trade for eliminating a class of runtime type bugs.
- Establishes a convention: **validate untrusted input with a Zod schema** at
  HTTP handlers, config/env loading, and any other untyped boundary. This will
  be documented in `docs/architecture.md` as patterns emerge.

## Alternatives considered

- **valibot:** lighter/modular bundle, but Zod has broader adoption, ecosystem,
  and integrations; bundle size is not a priority for a server-side API.
- **Manual type guards / hand-written validation:** no dependency, but verbose,
  error-prone, and drifts from the types.
- **Trusting inputs / casting:** violates ADR 0009; rejected.
