# 0021. Run the local database with Docker Compose

- Status: Accepted
- Date: 2026-09-05

## Context

Development and (per ADR 0015) repository integration tests need a real
PostgreSQL (ADR 0008). We want a reproducible, one-command way to run the
database locally without requiring each developer to install/manage Postgres on
their host.

## Decision

Provide a **`docker-compose.yml`** at the repo root that runs **PostgreSQL** as
a service for local development. `docker compose up -d` starts it; the app
connects via `DATABASE_URL` (see `.env.example`).

- Postgres image pinned to a specific major version (`postgres:17-alpine`).
- Credentials/db name match the `DATABASE_URL` in `.env.example`
  (`user`/`password`/`integration_system`).
- Data persisted in a named volume; a healthcheck reports readiness.

## Consequences

- One-command, reproducible local database; no host Postgres install needed.
- The Compose Postgres major version should match the version used by
  Testcontainers (ADR 0015) so local, CI, and tests behave identically.
- Compose is for **local dev only**; it is not the production deployment
  mechanism. Production DB provisioning is a separate, later concern.
- Default local credentials are non-secret and fine for dev; real environments
  use their own secrets via `DATABASE_URL`.

## Alternatives considered

- **Host-installed PostgreSQL:** no Docker dependency, but not reproducible and
  burdens every developer with setup/version drift.
- **A hosted/cloud dev database:** avoids local infra, but adds latency, cost,
  and network dependency for everyday development and tests.
