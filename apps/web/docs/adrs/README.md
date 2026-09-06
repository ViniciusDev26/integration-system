# Architecture Decision Records (ADRs) — web

Front-end decisions for `apps/web` (the Vite SPA).

- [0001](./0001-vite-react-typescript-spa.md) — Vite + React + TypeScript SPA
- [0002](./0002-biome-lint-format.md) — Biome for lint + format (shared config)
- [0003](./0003-shadcn-ui-and-tailwind.md) — shadcn/ui + Tailwind CSS
- [0004](./0004-forms-react-hook-form-and-zod.md) — Forms: react-hook-form + Zod
- [0005](./0005-zustand-state-management.md) — Zustand for client state
- [0006](./0006-api-client-axios-isolated.md) — Backend access via axios in an isolated API client *(superseded by 0008)*
- [0007](./0007-auth-httponly-cookie-same-origin.md) — httpOnly session cookie, SPA served same-origin (no SSR)
- [0008](./0008-trpc-client-and-tanstack-query.md) — Backend access via the tRPC client + TanStack Query

Repo-wide decisions live in [`/docs/adrs`](../../../../docs/adrs/) (monorepo,
shared Biome config). These records capture *decisions already made*; most are not
yet implemented in code — implementation follows (adding each dependency happens
in the same change as its use, per the root `AGENTS.md` dependency rule).

## Conventions

One decision per ADR. Filename `NNNN-title-in-kebab-case.md`, numbered from
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
