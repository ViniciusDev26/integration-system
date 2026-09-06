# 0002. Shared Biome config as a workspace package

- Status: Accepted
- Date: 2026-09-06

## Context

Both apps use Biome for lint + format (apps/api ADR 0010). In a monorepo we want
one source of truth for the shared rules, but each app has different needs: the
API is Node/TypeScript (`src/**/*.ts`, `drizzle.config.ts`, `vitest.config.ts`);
the web app is a Vite React/TypeScript project (`src/**/*.{ts,tsx}`,
`vite.config.ts`).

## Decision

Publish the Biome configuration as an internal workspace package
**`@integration-system/biome-config`** (`packages/biome-config`) with three files:

- `biome.json` — the shared **base**: formatter, linter (`recommended` +
  `noExplicitAny`/`noNonNullAssertion` as errors), assist (organize imports), VCS
  ignore-file support.
- `biome.api.json` — `extends` the base; API-specific `files.includes`.
- `biome.web.json` — `extends` the base; web-specific `files.includes` (incl.
  `.tsx`).

Each app has a tiny `biome.json` that extends the matching variant by package
subpath: `{"extends": ["@integration-system/biome-config/api"]}` (or `/web`),
resolved via the package's `exports`. The single Biome binary lives at the repo
root (hoisted) and is invoked by each app's `lint`/`format` script.

## Consequences

- Shared rules change in one place; per-app nuances stay in the variant files.
- Adding a package to a workspace and referencing it by name keeps the intent
  explicit ("shared config package") rather than reaching across the tree with
  relative paths.
- `files.includes` in an extended config are matched relative to the app running
  Biome, so the variants can use app-relative globs.

## Alternatives considered

- **One root `biome.json` for everything:** simplest, but can't cleanly express
  per-app includes/nuances and couples the web app's needs to the API's.
- **Relative-path `extends` (`../../packages/...`):** works without `exports`,
  but leaks the physical layout into each app; the package-name reference is
  clearer and relocatable.
