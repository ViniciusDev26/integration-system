# 0005. Execution model and development workflow

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0004 established that the project builds with `tsc`. We still need to define
how the compiled API is actually run, and what the developer's edit loop looks
like.

## Decision

- **Run the compiled output directly on Node:** build with `tsc`, then start the
  API with `node dist/server.js`.
  - The compiled JavaScript is emitted to `dist/`.
  - The application entry point is `dist/server.js` (compiled from the
    corresponding TypeScript entry source, e.g. `src/server.ts`).
- **Development loop:** on a code change, **rebuild** with `tsc` and **restart**
  the dev server, so the running process always reflects the compiled current
  source. No separate runtime transpiler is used to run the app.

## Consequences

- A single, explicit run command (`node dist/server.js`) in every environment,
  including production — no runtime TypeScript execution to reason about.
- The build must run before the app can start; the dev workflow automates the
  rebuild + restart cycle on change.
- Requires an `outDir` of `dist` in the TypeScript config (a deliberate,
  concrete deviation from the plain recommended defaults, per ADR 0004) and a
  defined entry file `src/server.ts` → `dist/server.js`.
- The **specific tooling** for the watch/rebuild/restart loop (e.g. `tsc -w`
  combined with a process watcher, or an npm script) is an implementation
  detail and is not fixed by this ADR; the *workflow* (rebuild then restart) is.
- Concrete run/dev commands will be captured as npm scripts and documented in
  `docs/architecture.md` once scaffolding exists, and referenced by `AGENTS.md`
  for change validation.

## Alternatives considered

- **Run TypeScript directly in dev (e.g. `tsx`, ts-node, Node type stripping):**
  faster feedback with no build step, but diverges from how the app runs in
  production; we prefer dev and prod to share the same "compiled JS on Node"
  execution model.
- **Long-running incremental watch without restart (HMR):** more complex and not
  well-suited to a plain Node HTTP process; a rebuild + restart is simpler and
  sufficient.
