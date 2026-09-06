# 0001. Monorepo with Turborepo + npm workspaces

- Status: Accepted
- Date: 2026-09-06

## Context

The project outgrew a single API app: we are adding a browser front-end
(`apps/web`, Vite) that will consume the existing HTTP app (`apps/api`) as a
JSON API, plus a persistent cross-page audio player. We want the two apps in one
repository with shared tooling, atomic cross-cutting changes, and one dependency
graph — while keeping each app independently buildable/testable. npm is already
the mandated package manager (apps/api ADR 0006).

## Decision

Adopt a **monorepo** managed by **npm workspaces** for dependency/linking and
**Turborepo** for task orchestration/caching.

- Layout: `apps/api`, `apps/web`, shared code under `packages/*` (first member:
  `@integration-system/biome-config`, ADR 0002). Internal packages use the
  `@integration-system/*` scope.
- Root `package.json` declares `workspaces: ["apps/*", "packages/*"]` and
  delegates `build`/`dev`/`lint`/`typecheck`/`test`/`format` to `turbo run *`;
  `turbo.json` defines the task graph (e.g. `build` depends on `^build`, outputs
  `dist/**`; `dev` is persistent + uncached).
- **Infra stays at the repo root**: `docker-compose.yml`, `Dockerfile`,
  `.env(.example)`, `.npmrc`, `.tool-versions`. The Docker build context is the
  root so workspace manifests + the single lockfile drive `npm ci`.
- **Docs**: repo-wide ADRs here (`/docs/adrs`); each app keeps its own
  (`apps/*/docs/adrs`). Top-level guides (`AGENTS.md`, `tasks.md`, `memory.md`)
  stay at the root.
- npm stays enforced (`only-allow npm` preinstall at root; `engine-strict`).

## Consequences

- One `npm install` at the root links workspaces; a single lockfile.
- Turbo caches per-task and runs only what changed; `turbo run build` respects
  cross-package order.
- Docker builds must be workspace-aware (copy root + workspace manifests before
  `npm ci`); slightly more complex Dockerfile, accepted.
- Existing api ADRs (0001–0032) move under `apps/api/docs/adrs` unchanged; their
  decisions still hold for that app.

## Alternatives considered

- **Separate repositories:** independent versioning but painful cross-cutting
  changes and duplicated tooling; rejected for a small two-app project.
- **npm workspaces without Turborepo:** works, but no task graph/caching; Turbo
  is low-cost and pays off as tasks grow.
- **pnpm/yarn workspaces / Nx:** capable, but npm is already mandated (ADR 0006)
  and Turbo is lighter-weight than Nx for this scale.
