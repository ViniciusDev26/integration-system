# Architecture Decision Records (ADRs) — monorepo

This directory holds **repo-wide** decisions (how the monorepo itself is
structured and tooled). App-specific decisions live with each app:

- API: [`apps/api/docs/adrs/`](../../apps/api/docs/adrs/)
- Web: [`apps/web/docs/adrs/`](../../apps/web/docs/adrs/)

## Conventions

- One decision per ADR. Filename `NNNN-title-in-kebab-case.md`, numbered from
  `0001`. Once **Accepted**, treat as immutable; supersede with a new ADR.

## Template

```
# NNNN. <title>

- Status: Proposed | Accepted | Superseded by <link> | Deprecated
- Date: YYYY-MM-DD

## Context
## Decision
## Consequences
## Alternatives considered
```
