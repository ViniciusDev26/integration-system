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

  /** PostgreSQL connection string used by the Drizzle client (ADR 0008/0024). */
  DATABASE_URL: z.url(),

  /**
   * Public base URL of this API — scheme + host (+ port), no trailing slash. The
   * GitHub OAuth callback is derived as `${PUBLIC_BASE_URL}/auth/github/callback`
   * and must match the OAuth App's registered callback (ADR 0020). A trailing
   * slash is stripped so the derivation stays correct.
   */
  PUBLIC_BASE_URL: z.url().transform((value) => value.replace(/\/+$/, "")),

  /** GitHub OAuth App credentials (ADR 0020). */
  GITHUB_CLIENT_ID: z.string().min(1),
  GITHUB_CLIENT_SECRET: z.string().min(1),

  /**
   * Object storage for audio files (Cloudflare R2, S3-compatible — ADR 0007/0031).
   * Named vendor-neutrally (`STORAGE_*`) to match the `ObjectStorage` port. The
   * account id derives the S3 endpoint; the keys authenticate; the bucket holds
   * the objects.
   */
  STORAGE_ACCOUNT_ID: z.string().min(1),
  STORAGE_ACCESS_KEY_ID: z.string().min(1),
  STORAGE_SECRET_ACCESS_KEY: z.string().min(1),
  STORAGE_BUCKET: z.string().min(1),
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
