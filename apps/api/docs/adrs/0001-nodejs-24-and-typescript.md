# 0001. Use Node.js 24 and TypeScript

- Status: Accepted
- Date: 2026-09-05

## Context

The project needs a runtime and a programming language before any application
code can be written. This is the foundational choice that most later decisions
(HTTP framework, tooling, build, testing) will depend on.

At this point no domain or requirements have been finalized, but the project is
being built as a server-side system (see ADR 0002 for the HTTP layer). We need
a mainstream, well-supported runtime and a language that supports maintainable,
AI-assisted development.

## Decision

- Use **Node.js 24** as the runtime.
- Use **TypeScript** as the implementation language, compiled/run on Node 24.

## Consequences

- Access to the npm ecosystem and mature server-side libraries.
- Static typing improves correctness, refactoring safety, and the quality of
  AI-assisted changes, at the cost of a build/type-check step.
- The team commits to keeping up with the Node 24 release line (LTS lifecycle,
  security updates).
- Several sub-decisions are now implied but **not yet decided** and remain open
  (tracked in `memory.md`): package manager, TypeScript config strictness,
  module system (ESM vs CommonJS), build/transpilation strategy (e.g. `tsc`,
  native TS execution, or a bundler), and test framework. Each significant one
  should get its own ADR when made.

## Alternatives considered

- **Plain JavaScript on Node:** lower upfront friction, but loses static typing
  and the safety it provides for long-term maintenance and AI-driven edits.
- **Other runtimes (e.g. Deno, Bun):** modern and TypeScript-native, but Node
  has the broadest ecosystem, tooling maturity, and operational familiarity,
  which lowers risk for this project.
- **Other typed languages (Go, etc.):** viable, but would forgo the npm
  ecosystem and the team's/agents' JavaScript/TypeScript fluency.
