import { defineConfig } from "drizzle-kit";

// DATABASE_URL is provided via node's `--env-file-if-exists=.env` in the
// `db:migrate` script (package.json). `generate` needs no connection.
export default defineConfig({
  schema: "./src/shared/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
