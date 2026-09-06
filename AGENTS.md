# AGENTS.md

This document defines how AI agents should work on this project. It is the
primary operating manual for any agent (or human) making changes here. Read it
before doing anything else.

At this stage the project is **technology-agnostic**. No stack, architecture,
or domain has been chosen. These rules are intentionally general and contain
no technology-specific guidance. Technology-specific rules will be added only
once real decisions are made and recorded (see ADRs).

---

## 1. Core principles

1. **Documentation is part of the work.** A change is not complete until the
   relevant documentation is updated. Code and docs evolve together.
2. **Decisions are explicit.** Significant choices are recorded as ADRs, not
   left implicit in code.
3. **No silent assumptions.** When something is unknown, make the uncertainty
   visible (in `memory.md` or as an open question) rather than guessing.
4. **Emergent, not speculative.** Document what is actually true and decided —
   never invent requirements, architecture, or future features.
5. **Small, verifiable steps.** Prefer changes that can be validated over large
   unverifiable leaps.

---

## 2. How to reason about and modify the project

- **Understand before changing.** Read `memory.md`, `docs/architecture.md`, and
  the relevant ADRs in `docs/adrs/` before modifying anything.
- **Stay within scope.** Do only what the current task requires. Do not
  introduce a technology stack, framework, or architectural pattern unless the
  task explicitly calls for it and the decision is recorded as an ADR.
- **Prefer reversible changes.** When a choice is hard to reverse or has broad
  impact, pause and record it as an ADR before implementing.
- **Match what exists.** Once conventions emerge, follow them. Consistency with
  the existing project beats personal preference.
- **Surface conflicts.** If a task contradicts existing documentation or a
  recorded decision, stop and raise it rather than quietly overriding it.

---

## 3. How documentation should be maintained

The project has three documentation surfaces, each with a distinct role:

| File / dir              | Role                                                        | Stability |
| ----------------------- | ----------------------------------------------------------- | --------- |
| `docs/architecture.md`  | How the system is structured, as it emerges                 | Stable    |
| `docs/adrs/`            | Records of individual significant decisions                 | Immutable once accepted |
| `memory.md`             | Evolving working memory: state, discoveries, open questions | Volatile  |

Rules:

- Keep each surface in its lane. Don't put decisions in `memory.md` that belong
  in an ADR; don't put volatile working notes in `architecture.md`.
- Update documentation **in the same change** as the code or decision it
  describes.
- Write for the next agent. Assume the reader has no memory of this session.
- Remove or correct documentation that becomes wrong. Stale docs are worse than
  no docs.

---

## 4. When to create or update an ADR

Create a new ADR whenever an important **technical, architectural, or
structural decision** is made, for example:

- Adding (or replacing) **any dependency** — see the mandatory rule below.
- Choosing (or replacing) a technology, language, framework, or library.
- Defining or changing the system's architecture, boundaries, or key patterns.
- Establishing a project-wide convention or constraint.
- Making a trade-off that a future maintainer would need the reasoning behind.

### Every new dependency requires justification — mandatory

**No library, framework, or tool enters the project without an ADR that
justifies its existence.** This applies to every entry added to
`package.json` (runtime *and* dev dependencies), and to any external tool a
workflow relies on (e.g. a CLI, a Python package, a system binary).

- Before adding a dependency, write an ADR that answers: *what problem does it
  solve, why is a dependency the right answer (vs. the standard library or
  existing deps), and what alternatives were rejected and why.* The ADR's
  **Alternatives considered** section is not optional here.
- Adding the dependency and writing its ADR happen in the **same change**. A
  new entry in `package.json` with no corresponding ADR is an incomplete change.
- Prefer **not** taking a dependency. A dependency is a permanent liability
  (supply chain, maintenance, upgrade cost); the burden of proof is on adding
  it, not on doing without.
- Trivial type-only stubs (`@types/*`) that merely type an already-justified
  dependency do not need their own ADR — record them alongside the dependency
  they type.

Guidelines:

- **One decision per ADR.** Keep them focused.
- **ADRs are append-only in spirit.** Do not rewrite the history of an accepted
  ADR. If a decision changes, create a new ADR that supersedes the old one and
  mark the old one as superseded (with a link).
- **Number and title clearly**, e.g. `0001-title-in-kebab-case.md`.
- Do **not** create ADRs speculatively. An ADR records a decision that has
  actually been made.

Suggested ADR structure (kept lightweight):

```
# <number>. <title>

- Status: Proposed | Accepted | Superseded by <link> | Deprecated
- Date: YYYY-MM-DD

## Context
What situation or problem forced a decision? What constraints applied?

## Decision
What was decided.

## Consequences
What becomes easier, harder, or constrained as a result. Trade-offs accepted.

## Alternatives considered
Options that were weighed and why they were not chosen.
```

---

## 5. How to use `memory.md`

`memory.md` is the project's **evolving working memory** — a scratchpad shared
across sessions and agents. Use it to:

- Record the **current state** of the work.
- Capture **discoveries** made during development.
- Track **open questions** and things still to decide.
- Hold **temporary context** that helps the next agent continue.

Do **not** use `memory.md` as a replacement for stable documentation:

- Durable structural knowledge belongs in `docs/architecture.md`.
- Decisions belong in an ADR under `docs/adrs/`.

When a fact in `memory.md` becomes stable or decided, **promote it** to the
proper place (architecture doc or ADR) and remove it from `memory.md`. Keep
`memory.md` current — prune what is no longer true.

---

## 6. How to document architectural decisions

- The **shape** of the system lives in `docs/architecture.md` — describe what
  exists as it emerges, not what might exist.
- The **reasoning** behind individual decisions lives in `docs/adrs/`.
- When you make an architectural decision: record the decision as an ADR, then
  reflect its outcome in `docs/architecture.md`. The ADR explains *why*; the
  architecture doc explains *what*.

---

## 7. How to handle uncertainty and assumptions

- **Do not guess silently.** If information is missing, prefer asking or
  recording the open question in `memory.md`.
- **Make assumptions explicit.** If you must proceed under an assumption, write
  it down (in `memory.md`, or in the ADR if it affects a decision) so it can be
  challenged later.
- **Avoid inventing requirements.** Build only what is asked for and justified.
- **Prefer the smallest choice that unblocks progress**, and flag it as
  provisional if it may need revisiting.

---

## 8. Project rules (technology-specific)

These rules apply now that the stack has been decided. They are backed by ADRs
in `docs/adrs/` — consult the ADR for the full reasoning.

### Type safety (ADR 0009) — mandatory

Code must be **100% type-safe**. Do **not** use type-check escape hatches:

- No `any` (explicit or implicit).
- No escape-hatch casts (`as unknown as X`, unsafe `as X` that launders an
  incompatible type).
- No `@ts-ignore`; `@ts-expect-error` only in a genuinely unavoidable case, with
  a justifying comment.
- No non-null assertions (`!`) to hide possibly-undefined values.

Instead: model types accurately, use `unknown` + narrowing, and validate
external/untyped boundaries (HTTP input, DB rows, R2 responses, env vars) at
runtime with a **Zod** schema (ADR 0011), deriving types via `z.infer`. For the
**HTTP boundary**, validate via `express-zod-safe` middleware at the route
layer, not inside handlers (ADR 0012); handlers never parse raw input. A change
that does not type-check cleanly without suppressions is not complete.

Enforcement: strict `tsconfig` (the type checker) + **Biome** lint rules
(ADR 0010) banning `any`/`!`/TS-suppressions + Zod at boundaries. Biome does not
do full type-aware linting, so review remains the backstop for unsafe casts.

### Code style & dependency injection (ADR 0026, ADR 0027)

- Write repositories/services/controllers as **factory functions returning an
  object** (closures), **not classes** (ADR 0026). Export the shape as a type.
- Define collaborators as **ports** (TS `interface`s); provide **adapters** as
  factories (e.g. `createPostgresUserRepository(db)`, and in-memory fakes for
  tests). Wire the graph **manually in a composition root** — no DI container
  (ADR 0027).
- Keep an implementation file to its factory: put its **types** in
  `x.service.types.ts` and its **constants** in `x.service.constants.ts`
  (dedicated files), not inline in the implementation.

### Test-Driven Development (ADR 0022) — mandatory for feature code

Implement behavior-bearing code with **TDD**: **red → green → refactor**. Write a
failing test that specifies the behavior first, then the minimum code to pass it,
then refactor under the green suite.

- **Repositories:** integration tests against real PostgreSQL via **Testcontainers**
  (ADR 0015), matching the Compose Postgres version (ADR 0021).
- **Services / controllers:** unit tests with fakes/mocks over the repository
  seam (ADR 0014).
- Trivial/mechanical changes (config, docs, scaffolding) are exempt.

## 9. How to validate changes before a task is considered complete

A task is done only when all of the following hold:

1. The change accomplishes what was asked — no more, no less.
2. Relevant documentation is updated (`architecture.md`, ADRs, and/or
   `memory.md`) in the same change.
3. Any significant decision made along the way is recorded as an ADR.
4. Open questions and remaining uncertainties are captured in `memory.md`.
5. For behavior-bearing code, it was built test-first (TDD, ADR 0022) and the
   test suite is green.
6. The change type-checks, builds, lints (Biome), and tests pass — per the
   project rules in §8.
7. Nothing was left in a broken or half-documented state.

If any of these cannot be satisfied, say so explicitly rather than declaring
the task complete.
