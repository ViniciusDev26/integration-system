# 0004. Forms with react-hook-form + Zod

- Status: Accepted
- Date: 2026-09-06

## Context

The app has forms (login-adjacent flows, music upload, playlist create/add) that
need ergonomic state handling, good performance, and validation that produces
typed values and clear error messages — ideally the same schema shape used to
type the data.

## Decision

Use **react-hook-form** for form state and **Zod** for validation, wired via
**`@hookform/resolvers`** (`zodResolver`).

- Zod schemas define each form's shape; types are derived with `z.infer` (no
  duplicate types). This mirrors the API's Zod-at-boundaries approach (API
  ADR 0011) — the front validates input before it hits the network.
- react-hook-form keeps inputs uncontrolled for minimal re-renders; shadcn/ui's
  form primitives integrate with it.

## Consequences

- One validation library (Zod) across forms and any other client-side parsing;
  schema-derived types keep forms type-safe end to end.
- Validation runs client-side for UX; the server still validates independently
  (never trust the client).
- Adds `react-hook-form`, `zod`, `@hookform/resolvers` (justified here).

## Alternatives considered

- **Formik:** popular but heavier and more re-render-prone than react-hook-form.
- **Native/uncontrolled forms by hand:** no dependency, but re-implements
  validation wiring and error handling.
- **Yup / Valibot instead of Zod:** capable, but Zod matches the API app and the
  team's existing usage; one validator across the repo.
