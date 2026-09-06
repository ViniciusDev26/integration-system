# 0036. Retire SSR; the app becomes an API for the SPA

- Status: Accepted
- Date: 2026-09-06
- Supersedes: [0030](./0030-server-side-rendered-ui-handlebars.md)

## Context

The browser UI is moving to a Vite React SPA (`apps/web`) served **same-origin**
by this app; auth stays a server-side session in an httpOnly cookie (web ADRs
0001/0006/0007). The server-rendered controllers returned HTML/redirects
(ADR 0030), which a SPA can't consume — it needs data + status codes. The
controllers were only thin translators over the services; the reusable logic is
the **services**, not the HTTP layer.

## Decision

Drop server-side rendering and make this app an **API** consumed by the SPA:

- **Remove the SSR layer**: the `web` module, the Handlebars templates
  (`src/views/`), and the `express-handlebars` dependency. **Supersedes ADR 0030.**
- The GitHub OAuth flow stays a browser redirect under `/auth` (`/auth/github` +
  `/auth/github/callback`); `logout` becomes a data operation (no redirect).
- Authentication for API calls responds **401** for anonymous requests (no
  redirect) — the SPA drives the `/auth/github` redirect itself.
- **Serve the SPA same-origin**: static `apps/web/dist` + an SPA fallback to
  `index.html` for non-API/`/auth` GETs (guarded — inert until the SPA is built).
  Dev uses the Vite proxy → this app.

The **transport** for the API is decided separately: see
[0037](./0037-trpc-api-and-end-to-end-types.md) (tRPC, end-to-end types).

## Consequences

- One code path (the API) over the shared services; no dead SSR views.
- The browser talks to a same-origin API; the httpOnly cookie is sent
  automatically.
- Until the SPA build exists, the app exposes only the API, `/auth`, and
  `/health` — no server-rendered home page in the interim.

## Alternatives considered

- **Keep SSR + add an API (coexist):** two UIs/HTTP layers to maintain during a
  transition that has no reason to be gradual here. Rejected.
- **Content negotiation (HTML vs JSON):** one handler, two response models —
  brittle and muddies the controllers.
- **Separate origin for the SPA:** needs CORS + `SameSite=None` (web ADR 0007);
  rejected in favor of same-origin.
