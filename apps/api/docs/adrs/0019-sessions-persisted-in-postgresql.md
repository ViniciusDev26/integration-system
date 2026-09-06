# 0019. Persist server-side sessions in PostgreSQL

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0016 chose server-side sessions referenced by an httpOnly cookie, but left
open where session data is persisted (PostgreSQL vs Redis vs in-memory).

## Decision

Persist sessions in **PostgreSQL** — the primary database already in the stack
(ADR 0008) — as a `sessions` table accessed through a session repository
(Repository pattern, ADR 0014) via Drizzle (ADR 0013).

Indicative shape: `sessions(id, user_id, expires_at, created_at, ...)`. The
cookie carries only the opaque session id.

## Consequences

- **No new infrastructure:** reuses PostgreSQL; nothing extra to run, deploy, or
  add to Testcontainers.
- **Durable & revocable:** sessions survive restarts and can be invalidated
  server-side immediately (ADR 0016 rationale).
- **Testable:** the session repository is integration-tested against real
  Postgres via Testcontainers (ADR 0015), like every other repository.
- **Cost:** a DB read per authenticated request. Acceptable at this scale; a
  cache can be added later if needed without changing the model.
- Requires an **expiry/cleanup** strategy for stale sessions (e.g. `expires_at`
  + periodic cleanup) — an implementation detail for the auth work.

## Alternatives considered

- **Redis:** fast with native TTL, but adds a new service to run/deploy and
  test — over-infrastructure for the current scale.
- **In-memory:** trivial to start, but loses sessions on restart and does not
  scale horizontally; effectively immediate tech debt.
