# 0008. Backend access via the tRPC client + TanStack Query

- Status: Accepted
- Date: 2026-09-06
- Supersedes: [0006](./0006-api-client-axios-isolated.md)

## Context

The API is now **tRPC** (api ADR 0037): it exposes typed procedures and its
`AppRouter` type, not REST/JSON endpoints. The earlier plan (ADR 0006 — axios in
an isolated API client) assumed REST; with tRPC we get end-to-end types by
importing the router type from the API package, so an axios client is the wrong
tool for the data layer.

## Decision

Use the **tRPC client** (`@trpc/client`) integrated with **TanStack Query** via
`@trpc/react-query`, importing `AppRouter` from `@integration-system/api/trpc`
(type-only, across the workspace).

- One typed client in `src/api/` (an "isolated backend access" module, keeping
  the spirit of ADR 0006): a `httpBatchLink` to **`/trpc`** with
  `fetch(..., { credentials: "include" })` so the httpOnly session cookie is sent
  (web ADR 0007). Components/hooks call procedures via the generated hooks, never
  `fetch`/`axios` directly.
- **TanStack Query** provides caching, loading/error states, and invalidation for
  server data — the client data layer deferred in web ADR 0005 is adopted here.
- **Uploads** use presigned direct-to-R2 (api ADR 0038): call `musics.prepareUpload`
  (tRPC), then `PUT` the file to the returned URL with the browser `fetch` (no
  axios, no cookies on that cross-service request), then `musics.create` (tRPC).

## Consequences

- Change a procedure and the web app fails to type-check — the point of tRPC.
- **axios is not used** for the API; the isolated-client goal from ADR 0006 stands,
  but the implementation is the tRPC client (+ `fetch` for the R2 PUT). ADR 0006 is
  superseded.
- Adds `@trpc/client`, `@trpc/react-query`, `@tanstack/react-query` (justified
  here). React state for server data lives in Query, not Zustand (ADR 0005 —
  Zustand stays for client/UI state like the player).

## Alternatives considered

- **axios REST client (ADR 0006):** no shared types without codegen; moot now that
  the API is tRPC.
- **tRPC client without React Query (`@trpc/client` only):** typed calls but no
  cache/hooks; we'd rebuild fetching/caching by hand. TanStack Query is the
  idiomatic pairing.
