# 0006. Backend access via axios in an isolated API client

- Status: Accepted
- Date: 2026-09-06

## Context

The SPA talks to the API over HTTP. We want backend access **isolated in one
place** (not scattered `axios`/`fetch` calls across components), so endpoints,
base URL, credentials, and error handling are defined once and the rest of the
app depends on typed functions — the same "adapters at the edge" spirit as the
API's repository/port pattern.

## Decision

Use **axios**, wrapped in a single **API client module** (e.g. `src/api/`): one
configured `axios` instance plus typed endpoint functions; components/hooks call
those functions, never `axios` directly.

- The instance sets `baseURL` (`/api`) and **`withCredentials: true`** so the
  httpOnly session cookie rides along (ADR 0007).
- Responses are validated/typed at this boundary (Zod where useful), so typed data
  flows inward — untyped `any` from axios never leaks (repo type-safety rule).
- axios matches the API app's HTTP client choice (API ADR 0028): interceptors,
  timeouts, and uniform error handling in one spot.

## Consequences

- One seam for the backend: swapping transport, adding auth-refresh/error mapping,
  or mocking in tests happens in the client module only.
- Endpoint functions are the app's typed contract with the API.
- Adds `axios` (justified here).

## Alternatives considered

- **Native `fetch` in a client module:** zero dependency and would satisfy the
  isolation goal, but axios gives interceptors/timeouts and matches the backend.
- **Calling `fetch`/`axios` directly from components:** rejected — scatters
  backend knowledge and duplicates credentials/error handling.
- **TanStack Query / RTK Query:** data-fetching/caching layers — orthogonal; can be
  layered on top of the API client later via its own ADR if caching needs grow.
