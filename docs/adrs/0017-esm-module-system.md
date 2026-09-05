# 0017. Use ESM as the module system

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0001/0004 left the module system (ESM vs CommonJS) following `tsc`/recommended
defaults. Writing the first application code forces the choice: it determines
`package.json` `type`, the TypeScript `module`/`moduleResolution` settings, and
how imports are written.

## Decision

Use **ESM** (ECMAScript Modules).

- `package.json`: `"type": "module"`.
- `tsconfig.json`: `module: NodeNext`, `moduleResolution: NodeNext`.
- Relative imports include the `.js` extension in source (e.g.
  `import { createApp } from "./app.js"`), as required by NodeNext ESM.

## Consequences

- Aligns with the modern Node.js 24 default and with libraries that ship as
  ESM-only.
- Top-level `await`, standard `import`/`export`, and native ESM tooling are
  available.
- Relative imports must carry explicit `.js` extensions (resolved against the
  compiled output); this is a known ESM ergonomic that all code must follow.
- Interop with CommonJS dependencies (e.g. Express) works via Node's ESM/CJS
  interop; `esModuleInterop` is enabled for default imports.

## Alternatives considered

- **CommonJS:** maximum ecosystem compatibility and no import-extension
  requirement, but is the legacy path and does not consume ESM-only packages
  natively. Rejected in favor of the modern default.
