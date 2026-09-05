import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Database } from "../shared/db/database.js";
import * as schema from "../shared/db/schema/index.js";

export interface TestDatabase {
  db: Database;
  stop: () => Promise<void>;
}

/**
 * Spin up a disposable PostgreSQL 18 container, apply the real Drizzle
 * migrations, and return a Drizzle handle for repository integration tests
 * (ADR 0015). The Postgres version matches Compose (ADR 0021).
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  // Testcontainers may resolve the Docker host to the bridge gateway
  // (e.g. 172.17.0.1), which is unreachable on some setups (notably WSL2),
  // making container/Reaper connections hang. Published ports ARE reachable via
  // localhost, so default the host to localhost unless the environment already
  // provides one (e.g. CI / docker-in-docker).
  process.env.TESTCONTAINERS_HOST_OVERRIDE ??= "localhost";

  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:18-alpine",
  ).start();

  const client = postgres(container.getConnectionUri(), { max: 1 });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "drizzle" });

  return {
    db,
    stop: async () => {
      await client.end();
      await container.stop();
    },
  };
}
