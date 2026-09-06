# 0030. Server-side rendered UI with Handlebars (express-handlebars)

- Status: Accepted
- Date: 2026-09-05

## Context

The API needs a minimal UI so the auth flow (and future features) can be
exercised by a human in a browser rather than only via an HTTP client. The app
is an Express server (ADR 0002) rendering on the server; there is no SPA and no
client build step, and none is wanted at this stage. We need a view layer that
renders HTML on the server, with layouts/partials, and integrates cleanly with
Express and the existing type-safe, factory-based style (ADR 0009/0026).

## Decision

Render the UI **server-side with Handlebars**, via the **`express-handlebars`**
engine.

- Register it as Express's view engine in `createApp` (ADR 0027 keeps wiring in
  one place): `app.engine("handlebars", engine(...))`, `view engine` =
  `handlebars`, views resolved from `import.meta.dirname + "/views"`.
- Templates live in **`src/views/`**: `layouts/main.handlebars` (the shell) plus
  one template per page (e.g. `home.handlebars`). Handlebars is **logic-less** —
  no business logic in templates; controllers pass a ready view model.
- Templates are not TypeScript, so the build copies `src/views` → `dist/views`
  (`copy:views` script; the production image already ships `dist/`, ADR 0023).
  Resolving views relative to the compiled file means the same path works under
  Vitest (source), `dist` (dev), and the production image.
- A **`web`** feature module (`src/modules/web/`, ADR 0018) owns the page
  routes/controllers; auth actions stay in the `auth` module.

## Consequences

- A human can drive login/logout and see authenticated state in a browser; the
  `.http` file is no longer the only way to exercise endpoints.
- Auth actions become browser-friendly: the login callback and **logout** now
  redirect to `/` (the home page) instead of returning JSON/204, so a plain
  `<form>`/link flow works without client JavaScript.
- Views are plain HTML+Handlebars with no client bundler — simple, but no rich
  client interactivity. Acceptable for the current scope; a richer client is a
  separate future decision.
- Adds `express-handlebars` (+ Handlebars). Templates are validated by rendering
  in tests (supertest over the real engine), not by the type checker — keep
  logic out of them so this gap stays small.
- A build step now copies non-TS assets (`views`) into `dist`; the dev loop
  copies them on each successful compile.

## Alternatives considered

- **Other template engines (EJS, Pug, Nunjucks):** all viable. Handlebars was
  chosen for its logic-less discipline (keeps business logic in services/
  controllers, reinforcing our layering) and `express-handlebars`' first-class
  layouts/partials.
- **A client-rendered SPA (React/Vue + a build step):** far more machinery
  (bundler, client state, API-only backend) than a server-rendered demo UI needs
  right now. Rejected as premature.
- **Hand-written HTML template strings:** no dependency, but no layouts/partials
  or escaping discipline; error-prone as pages grow.
