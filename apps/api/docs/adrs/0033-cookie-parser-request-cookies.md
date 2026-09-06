# 0033. cookie-parser for reading request cookies

- Status: Accepted
- Date: 2026-09-06

## Context

Authentication relies on cookies: a server-side session referenced by an
httpOnly `session` cookie (ADR 0016), plus a short-lived `oauth_state` cookie
for CSRF protection during the GitHub OAuth flow (ADR 0020). To read these, the
app needs to turn the incoming `Cookie` request header into a usable map of
name → value.

Express 5 (ADR 0002) does **not** parse cookies out of the box: `req.cookies`
does not exist unless a parser populates it. We need cookie reading in the auth
and web controllers, and across their tests, without hand-parsing the `Cookie`
header (quoting, `;`/`=` splitting, whitespace, URL-decoding) in our own code.

We already validate all untyped HTTP input at the boundary with Zod
(ADR 0009/0011); whatever parses the header only needs to produce a plain
`{ [name]: value }` object that our `readCookie` helper
(`src/shared/http/cookies.ts`) then validates.

## Decision

Use **`cookie-parser`** as Express middleware to populate `req.cookies`.

- Register it once in `createApp` (`app.use(cookieParser())`), keeping wiring in
  one place (ADR 0027). No signed-cookie secret is configured — we do not rely
  on cookie signing; session integrity comes from the opaque server-side session
  token (ADR 0016/0019), not from a signed cookie.
- Controllers never touch `req.cookies` directly. They go through the shared
  `readCookie(req, name)` helper, which parses `req.cookies` (typed `unknown`)
  with a Zod schema and returns `""` when the cookie or the whole jar is absent
  or malformed. `cookie-parser` does the header splitting/decoding; Zod does the
  validation (ADR 0009/0011).

## Consequences

- `req.cookies` is available as a plain object in every request handler; reading
  the `session` and `oauth_state` cookies is a one-liner via `readCookie`.
- The correctness-sensitive `Cookie`-header parsing (quoting, encoding, edge
  cases) is delegated to a small, widely-used, Express-maintained library rather
  than reimplemented.
- Adds one runtime dependency (`cookie-parser`) and one dev dependency for its
  types (`@types/cookie-parser`). It is a mature, stable, single-purpose package
  under the Express org — low maintenance and supply-chain risk.
- Cookie *writing* is unaffected: responses set cookies via Express's built-in
  `res.cookie` / `res.clearCookie`, so this dependency is read-path only.

## Alternatives considered

- **Parse the `Cookie` header by hand:** no dependency, but re-implements fiddly,
  security-relevant parsing (quoting, `;`/`=` handling, URL-decoding) that is
  easy to get subtly wrong. Not worth owning for a solved problem.
- **The lower-level `cookie` package directly:** `cookie-parser` already wraps it
  and provides the Express middleware glue (populating `req.cookies`) we want.
  Using `cookie` alone would mean writing that glue ourselves for no benefit.
- **A session/cookie framework (e.g. `express-session`):** brings its own session
  model and store abstraction, which conflicts with our hand-rolled server-side
  sessions in PostgreSQL (ADR 0016/0019). Far more than "read a cookie" needs.
