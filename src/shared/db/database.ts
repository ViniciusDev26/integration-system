import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema/index.js";

/**
 * The Drizzle database handle type, bound to the project schema. Repositories
 * depend on this type (injected), not on the production singleton — so tests can
 * pass a Testcontainers-backed instance of the same type (ADR 0014, ADR 0015).
 */
export type Database = PostgresJsDatabase<typeof schema>;
