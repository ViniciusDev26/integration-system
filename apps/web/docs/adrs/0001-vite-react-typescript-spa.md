# 0001. Vite + React + TypeScript SPA

- Status: Accepted
- Date: 2026-09-06

## Context

The browser UI is moving off the server-rendered Handlebars pages (API app,
ADR 0030) into a dedicated front-end (`apps/web`) that consumes the API as a JSON
API and hosts a **persistent, cross-page audio player**. A player that keeps
playing across navigation requires a single long-lived document with client-side
routing (a full-page reload destroys the `<audio>` element), which points to a
client-rendered app rather than classic multi-page navigation.

## Decision

Build `apps/web` as a **client-rendered SPA** using **Vite + React +
TypeScript** (the default Vite `react-ts` scaffold, already in place).

- TypeScript everywhere, under the repo-wide type-safety rules (root AGENTS §8).
- Client-side routing keeps one document alive so the player persists.
- **No SSR** — it is unnecessary for httpOnly-cookie auth (see ADR 0007) and
  would contradict this decision.

## Consequences

- App-like navigation with a persistent player is achievable without a framework
  rewrite.
- We own routing/data-fetching/state choices explicitly (subsequent ADRs:
  shadcn/ui 0003, forms 0004, state 0005, API client 0006, auth 0007).
- No server rendering: initial HTML is a shell; content renders after JS loads
  (acceptable for an authenticated app behind login).

## Alternatives considered

- **Next.js / Remix (SSR/RSC):** powerful, but a much larger commitment, not
  needed for httpOnly cookies, and overkill for this app. Rejected (see ADR 0007).
- **Keep server-rendered Handlebars:** cannot keep audio playing across full-page
  navigations without heavy hacks; the whole point of the move.
- **Vue / Svelte:** capable, but React was chosen for ecosystem/familiarity.
- **Vanilla TS + a micro-router:** lighter, but we'd hand-build everything the
  React ecosystem (shadcn/ui, react-hook-form) gives us.
