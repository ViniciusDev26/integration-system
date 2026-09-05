# 0012. Validate HTTP input as middleware with `express-zod-safe`

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0011 chose Zod for runtime validation at boundaries. For the HTTP boundary
(Express, ADR 0002), validation logic can either live inside each
controller/handler or be extracted into route-level middleware. Putting parsing
and validation inside handlers mixes concerns and repeats boilerplate, and
handlers then still have to narrow types manually.

## Decision

Use the **`express-zod-safe`** library to perform request validation as Express
**middleware**, driven by Zod schemas (params, query, body). Validation is
declared at the route definition, **outside** the controller/handler. The
handler receives already-validated, correctly-typed request data.

## Consequences

- Separation of concerns: handlers contain business logic only; validation is
  declarative at the route layer.
- Type safety end-to-end: the middleware infers types from the Zod schemas, so
  handlers get typed `params`/`query`/`body` with no casts — reinforcing
  ADR 0009 and ADR 0011.
- Consistent validation-error handling at the edge, before handler logic runs.
- Establishes the standard pattern: **every route with input declares
  `express-zod-safe` middleware with Zod schemas; handlers never parse raw
  input.** To be documented in `docs/architecture.md` as HTTP conventions form.
- Adds a dependency layered on Zod + Express; it must stay compatible with the
  chosen Express and Zod versions.

## Alternatives considered

- **Validation inside each handler (call `schema.parse` manually):** works, but
  repeats boilerplate and mixes validation with business logic.
- **Hand-rolled Zod middleware:** possible, but `express-zod-safe` already
  provides a typed, tested solution for params/query/body.
- **Other Express+Zod middlewares (e.g. zod-express-middleware):** similar
  intent; `express-zod-safe` was chosen for its type-safety ergonomics.
