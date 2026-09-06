# 0037. tRPC as the API transport, with end-to-end types

- Status: Accepted
- Date: 2026-09-06

## Context

The app is now an API for the SPA (ADR 0036). We want the browser to consume it
with **full type-safety end to end** — request inputs and response shapes typed
in the client without a separate schema/codegen step — leveraging the monorepo
(both apps are TypeScript, same repo).

## Decision

Use **tRPC** as the API transport. The API exposes a tRPC **router** (via
`@trpc/server` + its Express adapter) mounted at **`/trpc`**; the web app imports
the router's **type** (`AppRouter`) from the API package and calls it with a typed
client (web ADR — tRPC client + TanStack Query). No REST controllers, no codegen.

- **Procedures over services** (ADR 0018/0027): thin resolvers call the existing
  services; no business logic in the transport. `publicProcedure` /
  `protectedProcedure` (a middleware that requires an authenticated user).
- **Input validation with Zod** via `.input(schema)` (ADR 0011) — replaces
  `express-zod-safe` for the API (that middleware, ADR 0012, remains only for the
  REST OAuth-callback query).
- **Context** carries `{ req, res, user }`: the current user is resolved from the
  httpOnly session cookie (reusing `authService.getCurrentUser`). `res` lets
  mutations set/clear cookies (e.g. logout).
- **Errors**: domain errors map to tRPC error codes (`UNAUTHORIZED`, `FORBIDDEN`,
  `NOT_FOUND`), which the client receives typed.
- **Type export**: the API package exports `AppRouter` (type only) for the web app
  to import across the workspace; no runtime coupling.
- File uploads are **not** tRPC (JSON-RPC only) — handled by presigned direct
  upload ([0038](./0038-presigned-direct-r2-upload.md)); tRPC issues the URLs and
  persists the resulting keys.

## Consequences

- Change a procedure's input/output and the web app fails to type-check until it
  adapts — the core benefit.
- Auth/OAuth redirects stay plain Express under `/auth`; everything else is tRPC
  under `/trpc`. `express-zod-safe` is nearly retired (kept for the callback).
- Couples web→api at the **type** level (dev-time only); fine in one monorepo,
  served same-origin.
- Adds `@trpc/server` (justified here); the client deps are a web ADR.

## Alternatives considered

- **REST + JSON controllers (previous plan):** works, but no shared types without
  OpenAPI/codegen, and more boilerplate (routes + schemas + typed requests).
- **REST + OpenAPI codegen:** typed client, but a codegen/build step and drift
  between spec and code; tRPC gives the types for free in a TS monorepo.
- **GraphQL:** powerful but heavier (schema, resolvers, client cache config) than
  this app needs.
