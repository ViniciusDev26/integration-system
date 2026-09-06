# Architecture Decision Records (ADRs)

This directory holds the project's **Architecture Decision Records** — one file
per significant technical, architectural, or structural decision.

ADRs are created over time, whenever an important decision is actually made. Do
not create ADRs speculatively. See [`../architecture.md`](../architecture.md)
for the resulting *shape* of the system; the ADRs here capture the *why*.

Every new dependency added to `package.json` must be justified by an ADR — see
the mandatory rule in [`../../AGENTS.md`](../../AGENTS.md) §4.

## Conventions

- One decision per ADR.
- Filename: `NNNN-title-in-kebab-case.md`, e.g. `0001-choose-runtime.md`.
- Number sequentially starting at `0001`.
- Once an ADR is **Accepted**, treat it as immutable. If a decision changes,
  write a new ADR that supersedes the old one, and mark the old one as
  `Superseded by <link>`.

## Template

```
# NNNN. <title>

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

See [`../../AGENTS.md`](../../AGENTS.md) for when to create or update an ADR.
