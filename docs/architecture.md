# Architecture

## Purpose of this document

This document describes the **architecture of the system as it emerges** — its
structure, components, boundaries, data flows, and the key patterns that hold
it together. It answers the question *"how is this system put together?"*.

It is a **stable** document: it should reflect what is actually true and
decided about the system, not speculation about what might be built.

- The **reasoning** behind individual architectural decisions is recorded
  separately as ADRs in [`adrs/`](./adrs/). This document captures the
  resulting *shape*; the ADRs capture the *why*.
- Volatile, in-progress notes and open questions belong in
  [`../memory.md`](../memory.md), not here.

See [`../AGENTS.md`](../AGENTS.md) for how and when to update this document.

---

## Current architecture

The system is a **server-side HTTP API**. Foundational technology choices have
been made; the internal structure and patterns are still to emerge.

### Domain & scope

A **sample music API**, similar to a Spotify-style service. It exposes music
metadata and playback URLs, with authenticated users. Planned surface:

- **Authentication** — social login via **GitHub** (OAuth), with authenticated
  state kept as a **server-side session referenced by an httpOnly cookie**
  ([ADR 0016](./adrs/0016-session-httponly-cookie-auth.md)). _First feature to
  implement._
- **`GET /playlist`** — list available playlists.
- **`GET /musics/:id`** — get a music's information plus a URL to listen.

Data is split between a **primary database** for metadata (users, playlists,
music info — relational vs NoSQL **decision pending**) and an **object store**
for the audio binaries (**Cloudflare R2**, S3-compatible —
[ADR 0007](./adrs/0007-r2-object-storage-for-audio-files.md)).

Indicative data model (to be realized as the Drizzle schema, ADR 0013):

- `users` — identity from GitHub login
- `playlists` — available playlists
- `musics` — music metadata + R2 object key for the audio file
- `playlist_musics` — join table (many-to-many playlist↔music)

### Technology stack

| Concern        | Choice            | Decision record                                   |
| -------------- | ----------------- | ------------------------------------------------- |
| Runtime        | Node.js 24        | [ADR 0001](./adrs/0001-nodejs-24-and-typescript.md) |
| Language       | TypeScript        | [ADR 0001](./adrs/0001-nodejs-24-and-typescript.md) |
| HTTP framework | Express           | [ADR 0002](./adrs/0002-express-http-framework.md)   |
| Test framework | Vitest            | [ADR 0003](./adrs/0003-vitest-test-framework.md)    |
| Build          | `tsc` + recommended tsconfig | [ADR 0004](./adrs/0004-build-with-tsc-and-recommended-tsconfig.md) |
| Execution      | `node dist/server.js` (compiled) | [ADR 0005](./adrs/0005-execution-and-dev-workflow.md) |
| Package manager | npm (exact versions, npm-only) | [ADR 0006](./adrs/0006-npm-package-manager.md) |
| Object storage | Cloudflare R2 (S3-compatible) | [ADR 0007](./adrs/0007-r2-object-storage-for-audio-files.md) |
| Primary database | PostgreSQL (relational) | [ADR 0008](./adrs/0008-postgresql-relational-database.md) |
| Data access / ORM | Drizzle ORM + Drizzle Kit (migrations) | [ADR 0013](./adrs/0013-drizzle-orm-data-access.md) |
| Auth | GitHub social login (OAuth) — _planned_ | — |
| Session | Server-side session, httpOnly cookie (not JWT) | [ADR 0016](./adrs/0016-session-httponly-cookie-auth.md) |
| Type safety | 100% type-safe, no escape hatches | [ADR 0009](./adrs/0009-strict-type-safety.md) |
| Lint / format | Biome | [ADR 0010](./adrs/0010-biome-linter-formatter.md) |
| Runtime validation | Zod (at boundaries) | [ADR 0011](./adrs/0011-zod-runtime-validation.md) |
| HTTP input validation | `express-zod-safe` middleware | [ADR 0012](./adrs/0012-express-zod-safe-validation-middleware.md) |

### Patterns & conventions

- **Data access — Repository pattern** ([ADR 0014](./adrs/0014-repository-pattern-data-access.md)):
  all database access goes through per-entity repositories; repositories are the
  only code that touches Drizzle directly. Services/handlers depend on
  repositories, not on the ORM. This seam is also the integration-test boundary
  and keeps the data layer free to diverge from a future domain layer.
- **Testing — data access** ([ADR 0015](./adrs/0015-testcontainers-repository-integration-tests.md)):
  the repository layer is tested with **integration tests against real
  PostgreSQL via Testcontainers**. Testing strategy for service/handler layers
  is not yet decided.
- **HTTP input validation** ([ADR 0012](./adrs/0012-express-zod-safe-validation-middleware.md)):
  validated by `express-zod-safe` middleware at the route layer; handlers
  receive typed, validated input and contain business logic only.

### Execution & layout

- Source lives under `src/`; the API entry point is `src/server.ts`.
- `tsc` compiles to `dist/`; the app runs as `node dist/server.js`.
- Development: on change, rebuild with `tsc` and restart the dev server
  ([ADR 0005](./adrs/0005-execution-and-dev-workflow.md)).

### Not yet decided

No components, boundaries, or architectural patterns have been chosen yet. The
module system (ESM vs CommonJS) currently follows the recommended tsconfig /
`tsc` defaults (see `../memory.md`). These sections will be filled in as the
architecture emerges, each significant decision recorded as an ADR.
