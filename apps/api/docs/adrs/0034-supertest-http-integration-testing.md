# 0034. supertest for HTTP-level controller/route testing

- Status: Accepted
- Date: 2026-09-06

## Context

We practice TDD (ADR 0022). Controllers and routes are tested at the **HTTP
seam**: middleware ordering, `express-zod-safe` validation (ADR 0012), cookie
reading/writing (ADR 0016/0033), status codes, redirects, and rendered
Handlebars output (ADR 0030) are all behaviors that only exist once a request
actually flows through the Express app (ADR 0002).

Unit-testing a controller function in isolation would bypass exactly the parts
most likely to break — the router wiring, validation middleware, and cookie
plumbing. We need to drive the real `createApp()` instance with real requests
and assert on real responses, without binding to a TCP port or hand-crafting
`req`/`res` mocks. The test runner is Vitest (ADR 0003).

## Decision

Use **`supertest`** to exercise the Express app over HTTP in tests.

- Tests import the app built by `createApp()` and wrap it with
  `request(app)`, issuing real requests (`.get`/`.post`/`.set("Cookie", …)`)
  and asserting on status, headers, redirects, and body. `supertest` binds the
  app to an ephemeral port for the duration of each request, so no fixed port or
  running server is needed.
- This is the standard way controller/route/middleware behavior is specified in
  this project (auth, web, music controllers, and the shared upload middleware
  all use it). Service and repository layers are tested at their own seams
  (fakes for services; Testcontainers for repositories, ADR 0014/0015) — not
  through `supertest`.

## Consequences

- Controllers, routers, validation middleware, and cookie handling are verified
  as an integrated whole, catching wiring/ordering bugs that isolated unit tests
  would miss. Handlebars templates (ADR 0030) are validated by rendering them
  through the real view engine in these tests.
- Tests read like the HTTP contract they enforce, which doubles as executable
  documentation of each endpoint.
- Adds two dev-only dependencies (`supertest` + `@types/supertest`); neither
  ships in the production image (ADR 0023). `supertest` is a mature, widely-used
  library and integrates with Vitest via plain `await`/assertions.
- These tests are heavier than pure unit tests (they route a full request), but
  remain in-process and portless, so they stay fast enough for the red→green
  loop (ADR 0022).

## Alternatives considered

- **Call controller functions directly with mocked `req`/`res`:** fast, but
  bypasses the router, validation middleware, and cookie parsing — i.e. the
  integration points most worth testing. Also couples tests to Express internals
  via brittle handmade mocks.
- **Start a real server and use `fetch`/`axios` against a fixed port:** works,
  but adds port management, lifecycle setup/teardown, and flakiness for no gain
  over `supertest`, which handles ephemeral binding automatically.
- **A different HTTP-assertion library (e.g. `pactum`, `chai-http`):** viable,
  but `supertest` is the de-facto standard for Express, minimal, and framework-
  agnostic (works cleanly with Vitest); no compelling reason to diverge.
