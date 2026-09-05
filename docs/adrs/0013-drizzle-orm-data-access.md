# 0013. Use Drizzle ORM for database access

- Status: Accepted
- Date: 2026-09-05

## Context

ADR 0008 chose PostgreSQL but left the data-access layer open (plain `pg`
driver vs query builder vs ORM) along with a migrations tool. We need typed,
maintainable access to the database that aligns with the 100% type-safety
policy (ADR 0009).

## Decision

Use **Drizzle ORM** for PostgreSQL access, including its schema definition and
**Drizzle Kit** for migrations.

## Consequences

- Schema is defined in TypeScript; query results are **fully typed**, which fits
  ADR 0009 and avoids casting database rows. Types flow from the schema to the
  queries.
- Drizzle is a thin, SQL-like query layer (not a heavy abstraction), keeping
  queries explicit and predictable — good for the structured relational model
  (users, playlists, musics, playlist_musics).
- Migrations are managed with **Drizzle Kit** (generate/apply), giving a
  versioned schema-evolution workflow.
- The Drizzle schema becomes the single source of truth for table structure;
  the indicative model in `docs/architecture.md` will be realized as Drizzle
  schema during implementation.
- Rows read from the DB are typed by Drizzle; where data still crosses an
  untyped edge, ADR 0011 (Zod) validation continues to apply. The two are
  complementary.
- Adds Drizzle + Drizzle Kit dependencies and a `drizzle.config` and schema
  files (to be created with scaffolding).

## Alternatives considered

- **Prisma:** popular and ergonomic, but a heavier runtime/engine and a separate
  schema language; Drizzle stays closer to SQL and to plain TypeScript.
- **Kysely:** excellent typed query builder, but no built-in schema/migrations
  story as integrated as Drizzle Kit.
- **Plain `pg` driver:** maximum control, but hand-typing rows conflicts with
  the type-safety goal and adds boilerplate.
- **TypeORM:** mature but decorator/Active-Record heavy and historically looser
  typing than Drizzle.
