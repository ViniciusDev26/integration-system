# 0010. Use Biome as the linter (and formatter)

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0009 requires 100% type-safe code and calls for automated lint rules to ban
escape hatches (`any`, unsafe casts, `@ts-ignore`, non-null assertions). A
linter must be chosen. The previously-assumed option was ESLint +
`@typescript-eslint`.

## Decision

Use **Biome** as the project's linter (Biome also provides formatting, which we
adopt as well). Configure Biome to enforce the type-safety policy from ADR 0009.

## Consequences

- A single, fast, zero-heavy-config tool for both linting and formatting,
  replacing the ESLint + Prettier combination.
- Relevant Biome rules to enable for ADR 0009 include `noExplicitAny`,
  `noNonNullAssertion`, and banning TS suppression comments. These are turned on
  in Biome's configuration (committed to the repo).
- **Caveat — type-aware linting:** Biome's linting is primarily syntactic and
  does not perform full type-aware analysis the way `@typescript-eslint` does.
  Rules that need type information (e.g. `no-unsafe-assignment`,
  `no-unsafe-call`) are not fully covered by Biome. The type-safety guarantee
  therefore relies on **three layers together**: (1) strict `tsconfig` (the
  compiler is the real type checker), (2) Biome rules banning `any`/`!`/TS
  suppressions, and (3) runtime validation at boundaries via Zod (ADR 0011).
  Code review remains the backstop for unsafe casts the tools cannot detect.
- The exact Biome configuration is an implementation detail to be added with
  scaffolding.

## Alternatives considered

- **ESLint + `@typescript-eslint`:** the most thorough for type-aware rules
  (`no-unsafe-*`), but heavier setup and slower; plus a separate formatter
  (Prettier). Biome was chosen for speed and simplicity, accepting the
  type-aware-rule gap covered by the compiler + review.
- **ESLint + Prettier without type-aware rules:** no advantage over Biome while
  keeping two tools.
