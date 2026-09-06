# 0007. Auth via httpOnly session cookie, SPA served same-origin (no SSR)

- Status: Accepted
- Date: 2026-09-06

## Context

Auth is a **server-side session referenced by an httpOnly cookie** (API
ADR 0016) — deliberately not readable by JS (XSS-safe), so no token is stored in
the SPA. GitHub OAuth is a server-side redirect flow that sets the cookie. The
open question was whether a client-rendered SPA needs SSR to use an httpOnly
cookie. It does not: the browser sends the cookie automatically when requests are
same-origin (or CORS-with-credentials); the SPA just needs to send credentials
and ask the server who the user is.

## Decision

Keep a pure SPA (no SSR) and serve it **same-origin** with the API.

- **Production:** the API (`apps/api`, Express) serves the built SPA
  (`apps/web/dist`) as static files with an SPA fallback to `index.html`, and the
  JSON API under `/api`. Same origin ⇒ the httpOnly `session` cookie
  (`SameSite=Lax`) is sent automatically.
- **Development:** the Vite dev server proxies `/api` → the API, so the browser
  sees one origin and the cookie flows in dev too.
- The API client sends **`withCredentials: true`** (ADR 0006). The SPA learns the
  current user via a `GET /api/me`-style endpoint (401 when signed out) and starts
  login by navigating to the existing `/auth/github` redirect flow.
- The API will need JSON endpoints under `/api/*` (mirroring today's SSR
  controllers) and the static-serving + SPA-fallback wiring — to be added with
  their own API-app ADR(s)/tasks.

## Consequences

- No access token in JS; XSS can't exfiltrate the session. `SameSite=Lax` gives
  baseline CSRF protection; state-changing requests still warrant CSRF review
  (per the existing auth follow-up).
- One origin in every environment ⇒ no CORS, no `SameSite=None`.
- Requires the API to serve the SPA build and expose `/api/*`; the current
  server-rendered pages are superseded incrementally (API ADR 0030 will be
  revisited when the SPA replaces them).

## Alternatives considered

- **Separate origins + CORS:** web and API on different origins; needs
  `Access-Control-Allow-Credentials`, an allow-list, and `SameSite=None; Secure`
  cookies — more config and a larger CSRF surface. Rejected for a single app.
- **SSR framework (Next.js/Remix):** unnecessary for httpOnly cookies and a large
  change that contradicts ADR 0001. Rejected.
- **Non-httpOnly token in JS (localStorage):** simplest cross-origin story but
  XSS-exposed; rejected — the httpOnly session is the whole point (API ADR 0016).
