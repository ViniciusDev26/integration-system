# 0008. Use a relational database (PostgreSQL) as the primary metadata store

- Status: Accepted
- Date: 2026-09-05

## Context

The music API stores metadata for users, playlists, and musics. A playlist
contains many musics and a music can belong to many playlists — a **many-to-many
relationship**. The read endpoints (`GET /playlist`, `GET /musics/:id`) are
structured queries over these entities. Audio binaries are stored separately in
R2 (ADR 0007); only a reference/object key is kept in this database.

The choice was between a relational database and a NoSQL document store. The
user requested help deciding.

## Decision

Use a **relational database**, specifically **PostgreSQL**, as the primary
metadata store.

Indicative model (to be refined during implementation):

- `users` — identity from GitHub login.
- `playlists` — available playlists.
- `musics` — music metadata, including the R2 object key for the audio file.
- `playlist_musics` — join table for the many-to-many playlist↔music relation.

## Consequences

- Referential integrity and joins are handled natively, matching the domain's
  entities and relationships.
- Stable, explicit schema; migrations become the mechanism for schema evolution.
- Strong consistency for reads/writes.
- Excellent Node.js/TypeScript ecosystem support (drivers, query builders, ORMs)
  — the specific data-access library (e.g. plain driver, Kysely, Drizzle,
  Prisma, TypeORM) is a **separate, not-yet-made decision** and will get its own
  ADR.
- Requires running/provisioning a PostgreSQL instance and managing connection
  configuration/secrets.

## Alternatives considered

- **NoSQL document store (MongoDB):** would fit a free-form/evolving schema or
  embedded documents, but the many-to-many playlist↔music relationship would
  require either data duplication or manual `$lookup` joins — a weaker fit for
  this structured domain.
- **Other relational engines (MySQL/MariaDB, SQLite):** viable; PostgreSQL was
  chosen for its feature set, strong JSON support, and ecosystem. SQLite was
  attractive for zero-ops simplicity but PostgreSQL better reflects a realistic
  deployment.
