# 0009. Code must be 100% type-safe — no type-check escape hatches

- Status: Accepted
- Date: 2026-09-05

## Context

The project is written in TypeScript (ADR 0001). TypeScript's guarantees are
only as strong as the code's discipline: a single `any` or forced cast can
silently disable checking across a call path. We want the type system to be a
reliable safety net, especially for AI-assisted changes.

## Decision

All code must be **100% type-safe**. The following are **forbidden**:

- `any` (explicit or implicit).
- Escape-hatch casts used to bypass the checker, e.g. `as unknown as X`,
  unsafe `as X` assertions that launder an incompatible type.
- `@ts-ignore` / `@ts-expect-error` to silence real errors (a genuinely
  necessary `@ts-expect-error` must carry a justifying comment and is the rare
  exception, not a tool for skipping type work).
- Non-null assertions (`!`) used to paper over possibly-undefined values.

Instead:

- Enable TypeScript **strict mode** and related strictness options in
  `tsconfig.json`.
- Model data accurately; use `unknown` + proper narrowing instead of `any`.
- Validate all **external/untyped boundaries** at runtime (HTTP request bodies
  and params, database rows, R2 responses, env vars) with a schema validator so
  values are safely typed without casting. (The specific validation library is
  a separate, not-yet-made decision.)

## Consequences

- The type system is trustworthy end-to-end; refactors and AI edits are safer.
- Requires runtime validation at boundaries rather than casting, which adds a
  little code but removes a class of runtime bugs.
- Enforcement should be automated: strict `tsconfig` plus lint rules (e.g.
  `@typescript-eslint` `no-explicit-any`, `no-unsafe-*`, `no-non-null-assertion`,
  `ban-ts-comment`). The linter is **not yet chosen** — a follow-up decision.
- A change that does not type-check cleanly (no suppressions) is not complete,
  per `AGENTS.md`.

## Alternatives considered

- **Pragmatic `any` in "hard" spots:** less upfront effort, but each escape
  hatch erodes the guarantee and tends to spread; rejected.
- **Type-check only, no lint enforcement:** the compiler alone does not ban
  `any`/casts, so casts could still slip in; automated lint rules are needed to
  make the policy enforceable.
