# 0004. Build with `tsc` using the recommended tsconfig base

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0001 chose Node.js 24 + TypeScript but left the build/execution strategy
and the TypeScript configuration open. The system is an **HTTP API**, so it
needs a straightforward, low-magic path from TypeScript source to runnable
JavaScript on Node.

## Decision

- Build with the **official TypeScript compiler (`tsc`)** — no bundler and no
  alternative transpiler.
- Base the `tsconfig.json` on the **recommended TypeScript configuration**
  (the community `@tsconfig/recommended` base / TypeScript's recommended
  defaults), rather than a hand-rolled or heavily customized config.
- Use **TypeScript's default compilation** behavior; deviate from the defaults
  only when a concrete need arises, and record such deviations.

## Consequences

- A simple, standard toolchain: `tsc` compiles `.ts` sources to `.js`, which
  Node 24 runs. Easy to understand, reproduce, and reason about for both
  developers and AI agents.
- No bundler step to configure or maintain for the API.
- The `tsconfig` follows a well-known, sensible baseline, reducing bikeshedding
  and config drift.
- Module system (ESM vs CommonJS) and other compiler options follow the
  recommended base / `tsc` defaults for now. If the project needs a specific
  module system or stricter options, that will be a follow-up decision (ADR).
- Vitest (ADR 0003) runs the TypeScript sources directly for tests and does not
  depend on the `tsc` build output.

## Alternatives considered

- **Bundler (esbuild, tsup, Vite, Rollup):** faster builds and single-file
  output, but adds tooling and configuration the API does not currently need.
- **Native TS execution at runtime (e.g. `tsx`, ts-node, Node's type
  stripping):** convenient in development, but we prefer a plain, explicit
  compiled artifact for running the API. Such tools may still be used ad hoc in
  development without changing this decision.
- **Hand-crafted tsconfig from scratch:** maximum control, but more maintenance
  and a higher chance of subtle misconfiguration than a vetted recommended base.
