# 0003. Use Vitest as the test framework

- Status: Accepted
- Date: 2026-09-05

## Context

The project needs a test framework to validate behavior. Per `AGENTS.md`, a
task is only complete once changes are validated, so an automated testing tool
is a foundational choice. This builds on ADR 0001 (Node.js 24 + TypeScript).

## Decision

Use **Vitest** as the test framework for the project.

## Consequences

- First-class TypeScript and ESM support with minimal configuration, which fits
  the Node 24 + TypeScript stack from ADR 0001.
- A Jest-compatible API (`describe`/`it`/`expect`) plus built-in mocking,
  coverage, and watch mode — familiar to developers and to AI agents.
- Once configured, the standard "how to run tests" command will be documented in
  `docs/architecture.md` / project tooling and referenced by `AGENTS.md` as part
  of the change-validation checklist.
- Vitest works best with (though does not require) Vite. Whether a Vite-based
  build/tooling setup is adopted for the app itself remains a separate, open
  decision (see `memory.md`).

## Alternatives considered

- **Jest:** the incumbent standard, but has historically required extra
  configuration for ESM and TypeScript; Vitest offers a smoother experience on
  this stack.
- **Node.js built-in test runner (`node:test`):** zero dependencies, but a
  smaller feature set and less mature TypeScript ergonomics.
- **Mocha/Chai:** flexible but requires assembling several libraries; Vitest is
  more integrated out of the box.
