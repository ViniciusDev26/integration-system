import { z } from "zod";

/**
 * Cookies parsed by `cookie-parser` arrive untyped (`any`). Validate at this HTTP
 * boundary (ADR 0009/0011) and read a single cookie by name, returning `""` when
 * it (or the whole jar) is absent or malformed.
 */
const cookiesSchema = z.record(z.string(), z.string()).catch({});

export function readCookie(req: { cookies: unknown }, name: string): string {
  const cookies = cookiesSchema.parse(req.cookies);
  return cookies[name] ?? "";
}
