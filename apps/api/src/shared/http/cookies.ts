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

/**
 * Parses a raw `Cookie` header into the same shape `cookie-parser` produces.
 *
 * The WebSocket upgrade (ADR 0039) never passes through Express middleware, so
 * `cookie-parser` has not run and the handshake request carries only the raw
 * header. Parsing it here keeps both transports reading the session cookie
 * through {@link readCookie}.
 *
 * Matches `cookie-parser`'s behaviour on the cases that matter: values are
 * percent-decoded (kept verbatim when that fails), the first occurrence of a
 * repeated name wins, and segments without `=` are skipped.
 */
export function parseCookieHeader(
  header: string | undefined,
): Record<string, string> {
  const jar: Record<string, string> = {};
  if (header === undefined || header.length === 0) {
    return jar;
  }

  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) {
      continue;
    }
    const name = segment.slice(0, separator).trim();
    if (name.length === 0 || jar[name] !== undefined) {
      continue;
    }
    jar[name] = decodeCookieValue(segment.slice(separator + 1).trim());
  }

  return jar;
}

/** Percent-decodes a cookie value, falling back to the raw text if invalid. */
function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
