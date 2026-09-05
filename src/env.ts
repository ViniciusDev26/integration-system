import { z } from "zod";

/**
 * Environment variables are an untyped, external boundary. Per ADR 0009 (100%
 * type-safe) and ADR 0011 (Zod at boundaries), we validate `process.env` once,
 * here, and export a fully-typed `env` object for the rest of the app to use.
 *
 * No other module should read `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment variables:\n${details}`);
  process.exit(1);
}

export const env = parsed.data;

export type Env = typeof env;
