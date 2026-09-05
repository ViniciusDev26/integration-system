# 0029. Run the whole dev environment with Docker Compose (app + db)

- Status: Accepted
- Date: 2026-09-05

## Context

[ADR 0021](./0021-docker-compose-local-database.md) introduced a
`docker-compose.yml` that runs **only PostgreSQL** for local development; the app
itself was run on the host (`npm run dev`). That still requires the developer to
have the right Node active (24, ADR 0001), install dependencies, and add
`DATABASE_URL` to their `.env`. We want a single command — `docker compose up` —
to bring up a working dev environment: database, migrations applied, and the API
running with hot reload.

[ADR 0023](./0023-dockerfile-production-image.md) defines a multi-stage
**production** image that ships only `dist/` + prod deps and runs
`node dist/server.js` — no watch, no dev tooling. It is deliberately not suited
to iterative development.

## Decision

Extend the Compose stack (ADR 0021 stays: Compose is **local dev only**, not a
deployment mechanism) to run the full environment:

- Add a **`dev` stage** to the `Dockerfile` (Node 24 alpine, full deps incl.
  dev). It runs `npm run dev` (`tsc-watch` → rebuild + restart on source change).
  Source is **bind-mounted** by Compose, so the stage copies only
  `package*.json` + `.npmrc` and installs; it copies no `src`. Runs as the
  unprivileged `node` user (uid 1000, matching the host) so files written to the
  bind mount (e.g. `dist/`) stay owned by the developer.
- Add an **`app`** service built from that `dev` stage: bind-mounts the repo for
  hot reload, keeps container-built `node_modules` in an **anonymous** volume (so
  the container's musl-built deps aren't shadowed by the host's, and `docker
  compose up -V` re-seeds it from a freshly built image), publishes port 3000,
  and reads config from the developer's `.env` (`env_file`) with
  `DATABASE_URL`/`PORT`/`NODE_ENV` forced via `environment` to target the
  `postgres` service.
- Add a one-shot **`migrate`** service (same `dev` image) that runs
  `npm run db:migrate` once Postgres is healthy; `app` waits for it to complete
  successfully. Startup order: `postgres` (healthy) → `migrate` (completed) →
  `app`.

The production build is unaffected: the `runner` stage remains the Dockerfile's
default (last) target; `docker build .` still produces the production image
(ADR 0023).

## Consequences

- **One command** (`docker compose up`) yields db + migrations + a hot-reloading
  API; no host Node/deps/`DATABASE_URL` setup needed. `DATABASE_URL` is provided
  by Compose, so it no longer has to be in the developer's `.env`.
- The dev image and bind-mount setup exist **only** for local dev; production
  still uses the lean `runner` image (ADR 0023). Two code paths to keep working.
- After a dependency change, rebuild the image and re-seed the anonymous
  `node_modules` volume in one step: `docker compose up --build -V` (`-V` renews
  anonymous volumes; the named `pgdata` is untouched). Without `-V`, the stale
  volume shadows the new deps and the app fails to resolve them.
- `.env` must exist (it carries the GitHub OAuth secrets, ADR 0020); copy
  `.env.example` first. Running the app on the host with `npm run dev` still works
  as before.
- Applying migrations automatically on `up` is a **dev** convenience; it is not a
  production migration strategy (that remains a separate concern).
- **Hot reload is platform-dependent.** `tsc-watch` reloads on source changes
  wherever the container receives filesystem events for the bind mount (native
  Docker on Linux/macOS). On **Docker Desktop + WSL2** with the **native
  TypeScript 7 compiler** (ADR 0001), the in-container watcher does **not** see
  host edits — TS7's `--watch` exposes no polling option, and its OS file
  notifications don't cross that bind mount (the file content/mtime do propagate,
  but nothing wakes the watcher). There, refresh with `docker compose restart app`
  after a change, or run `npm run dev` on the host (native WSL2 fs events work)
  with only Postgres in Compose. This is a known limitation, not a config bug.

## Alternatives considered

- **Keep only the DB in Compose (status quo, ADR 0021):** simplest, but the app
  still needs host Node + deps + `DATABASE_URL`; not the requested one-command DX.
- **Run the app from the production image in Compose:** no dev tooling, so every
  code change needs an image rebuild — no hot reload. Rejected for dev.
- **Auto-migrate inside the app's start command (`migrate && dev`)** instead of a
  separate service: fewer services, but mixes concerns and reruns on every app
  restart; a dedicated one-shot service with `service_completed_successfully` is
  clearer.
