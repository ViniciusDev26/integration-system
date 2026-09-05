import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env.js";
import type { Database } from "./database.js";
import * as schema from "./schema/index.js";

/**
 * Production database client: a postgres.js connection wrapped by Drizzle and
 * bound to the project schema (ADR 0013/0024). Repositories depend on the
 * injected {@link Database} type (ADR 0014/0027), never on this module directly —
 * only the composition root (`src/container.ts`) resolves the real handle here.
 *
 * The client is created lazily on first use (and postgres.js itself connects
 * lazily, on the first query), so importing this module opens no socket. That
 * keeps tooling and tests that never touch the DB free of a live connection.
 */
let sql: ReturnType<typeof postgres> | null = null;
let db: Database | null = null;

export function getDb(): Database {
  if (db === null) {
    sql = postgres(env.DATABASE_URL);
    db = drizzle(sql, { schema });
  }
  return db;
}

/** Closes the underlying connection pool, if one was opened. */
export async function closeDb(): Promise<void> {
  if (sql !== null) {
    await sql.end();
    sql = null;
    db = null;
  }
}
