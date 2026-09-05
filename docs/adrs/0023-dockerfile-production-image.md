# 0023. Containerize the API with a multi-stage Dockerfile

- Status: Accepted
- Date: 2026-09-05

## Context

The API needs a reproducible production artifact to deploy. Our build compiles
TypeScript to `dist/` with `tsc` and runs `node dist/server.js` (ADR 0005) on
Node 24 (ADR 0001), using npm (ADR 0006). This is distinct from
`docker-compose.yml`, which runs the local **database** for development
(ADR 0021).

## Decision

Provide a **multi-stage `Dockerfile`** that produces a small runtime image:

1. **builder** — `node:24.18.0-alpine`; `npm ci` (all deps) → `npm run build`
   (`tsc` → `dist/`).
2. **deps** — `npm ci --omit=dev` to get production-only `node_modules`.
3. **runner** — copies `dist/` + production `node_modules`, sets
   `NODE_ENV=production`, runs as the non-root `node` user, `EXPOSE 3000`,
   `HEALTHCHECK` against `/health`, `CMD ["node", "dist/server.js"]`.

A `.dockerignore` keeps the build context small and prevents copying `.env`,
`node_modules`, `dist`, `.git`, etc.

## Consequences

- Small, reproducible runtime image: no dev dependencies, no TypeScript sources,
  only compiled output + prod deps.
- Base image pinned to `node:24.18.0-alpine` (matches ADR 0001 and
  `.tool-versions`); Alpine is safe here because the dependency tree is pure JS.
- Runs as non-root and exposes a container `HEALTHCHECK` reusing the app's
  `/health` route (no extra tools — uses Node's global `fetch`).
- Config (PORT, DATABASE_URL, GitHub secrets, PUBLIC_BASE_URL) is supplied at
  runtime via environment, never baked into the image.
- The `.npmrc` `engine-strict` means the build fails on a wrong Node — desired.
- This Dockerfile is the app image only; it is not a deployment/orchestration
  choice (platform, registry, CI publish) — those remain separate decisions.

## Alternatives considered

- **Single-stage image:** simpler, but ships dev dependencies and TS sources —
  larger and unnecessary attack surface.
- **`-slim` (Debian) base:** glibc compatibility for native modules, but our
  deps are pure JS, so Alpine's smaller size wins. Revisit if a native/musl
  incompatibility appears.
- **Distroless base:** even smaller/hardened, but more friction (no shell,
  healthcheck/debug ergonomics); can revisit later for production hardening.
