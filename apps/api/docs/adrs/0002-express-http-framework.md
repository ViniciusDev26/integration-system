# 0002. Use Express as the HTTP framework

- Status: Accepted
- Date: 2026-09-05

## Context

The system exposes an HTTP interface and needs a framework to handle routing,
middleware, and request/response handling. This builds on ADR 0001 (Node.js 24
+ TypeScript).

## Decision

Use **Express** as the HTTP framework, running on Node.js 24 with TypeScript.

## Consequences

- A minimal, widely-understood framework with a large middleware ecosystem and
  abundant documentation, which suits AI-assisted development.
- Express is unopinionated: conventions for project structure, validation,
  error handling, and async patterns must be established by this project. These
  will be documented in `docs/architecture.md` and, where they constitute
  decisions, as future ADRs.
- TypeScript type definitions for Express (and middleware) will be needed; the
  exact packages/versions are an implementation detail, not decided here.

## Alternatives considered

- **Fastify:** higher performance and built-in schema validation, but a smaller
  ecosystem and less ubiquitous familiarity than Express.
- **NestJS:** batteries-included and TypeScript-first, but heavier and more
  opinionated than the project currently needs.
- **Node's built-in `http` module:** no dependency, but too low-level; we would
  reimplement routing and middleware that Express already provides.
