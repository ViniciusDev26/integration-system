# 0006. Use npm as the package manager, with exact versions and npm-only

- Status: Accepted
- Date: 2026-09-05

## Context

The stack (ADR 0001–0005) needs a single, agreed dependency manager. Allowing
multiple package managers in one repo leads to competing lockfiles and
non-reproducible installs. We also want deterministic dependency versions.

## Decision

- Use **npm** as the sole package manager.
- Configure `.npmrc` with **`save-exact=true`** so dependencies are pinned to
  exact versions (no `^`/`~` ranges) on install/update.
- **Accept only npm.** Enforce this so that yarn/pnpm are not used against the
  project. `.npmrc` sets **`engine-strict=true`**; completing the enforcement
  requires `package.json` (created with scaffolding) to declare an `engines`
  field and an npm-only guard (e.g. a `preinstall` running `npx only-allow npm`,
  and/or a `"packageManager": "npm@<version>"` field).

## Consequences

- One lockfile (`package-lock.json`) and one install path — reproducible builds.
- Exact versions mean upgrades are explicit and reviewable, at the cost of not
  auto-picking up semver-compatible patch releases (updates become deliberate).
- `.npmrc` is committed to the repo so the configuration applies to everyone.
- Full npm-only enforcement is only partially achievable via `.npmrc` today
  (no `package.json` yet). The `engines` field and npm-only guard are a
  **follow-up to complete when scaffolding is created** (tracked in `memory.md`).

## Alternatives considered

- **pnpm:** fast and disk-efficient with strict node_modules, but the project
  prefers npm's ubiquity and zero extra setup.
- **yarn:** mature, but adds another toolchain with no compelling advantage here.
- **Caret/tilde version ranges (npm default):** automatic minor/patch updates,
  but less deterministic than exact pinning; we prefer explicit upgrades.
