# 0047. A domain model separate from persistence, with value objects

- Status: Accepted
- Date: 2026-10-02
- Extends: [0046](./0046-domain-and-application-layers-inside-a-module.md)

## Context

ADR 0046 moved the rules out of services and into `domain/`. That fixed *where*
the rules live. It left the model itself thin:

```ts
export interface InviteState {
  revokedAt: Date | null;
  expiresAt: Date;      // any structurally similar object passes
}
```

The domain types are the Drizzle rows, so they carry whatever the table carries
and enforce nothing. `positionMs` is a `number`, non-negative only because of a
database `CHECK` and a `Math.max` in one function. A token is a `string`, so a
room id passes where a token is expected. Illegal states are representable.

Practising DDD is an explicit goal of this project (ADR 0018, and the plan
recorded in `memory.md`), so the learning cost here is part of the point rather
than overhead to be minimised.

One thing already modelled well is worth naming, because it is the target:
`PlaybackCommand` is a discriminated union, so a `SEEK` without a position
cannot be constructed. That is what "illegal states unrepresentable" means.

## Decision

Per module, in the same incremental way ADR 0046 proceeds:

### 1. Value objects with validating constructors

Branded types plus a smart constructor that is the only way to make one:

```ts
export type InviteToken = string & { readonly __brand: "InviteToken" };
export function inviteTokenFrom(raw: string): InviteToken;
```

**The brand is type-level only.** At runtime an `InviteToken` is a string and a
`PositionMs` is a number, so a value object crosses tRPC and Drizzle unchanged.
This is what makes the choice compatible with `room/domain/room.playback.ts`
being imported and called by the web client (ADR 0041): the client lifts a
plain wire value with the same shared constructor.

### 2. The domain model is not the table

A module's domain entity is defined by the domain, not inferred from Drizzle.
The repository maps between them — `toDomain(row)` on the way out, primitives on
the way in — so the table can gain a column without the domain noticing, and the
domain can hold a value object the table stores as text.

### 3. DTOs at the transport edge

Routers return a DTO built from the entity, not the entity itself. In practice
several already do this by hand; this names it and puts it in one place.

### Constructors throw; rules return outcomes

ADR 0046 established that a **rule** returns an outcome the application turns
into an error. A **constructor** is different: failing means the data is
invalid, which from a database row means corruption and from user input means
the transport validation was wrong. Those throw.

## Consequences

- **Illegal states stop being representable** where a value object exists. A
  negative position or an empty token cannot be constructed, so the `CHECK`
  constraint becomes a second line of defence rather than the only one.
- **Mapping code appears at every boundary** — repository and router. This is
  the real cost, and it is paid per module. It buys the table and the model the
  freedom to differ, which is the point of the separation.
- **The wire keeps working unchanged**, because brands erase. Had value objects
  been classes or closures, the client could not have called shared domain
  functions on wire data, and the single-source-of-truth property that rooms
  depend on would have been lost.
- **Two shapes per concept** — the entity and the row — so a reader must know
  which they hold. The mapper being the only crossing point is what keeps that
  answerable.
- **Incremental, per module.** Modules without invariants (`media/`, `users/`)
  are still excluded; this does not apply to them.

## Alternatives considered

- **Classes or closures with methods**, the conventional way to tie behaviour to
  data. Rejected on a concrete constraint rather than style: methods do not
  survive serialization, and `room/domain` is deliberately imported by the web
  client and called on values that arrived over tRPC. Branded types give the
  type-level guarantee without that cost. ADR 0026's preference for factory
  functions over classes points the same way.

- **Value objects only, keeping the Drizzle row as the entity.** Cheaper, and it
  removes the mapping code. Rejected because the row would still dictate the
  model — adding a column would add it to the domain, and the domain could not
  hold a type the table does not have.

- **Leaving the model thin.** Defensible: the rules are already in the right
  place after ADR 0046, and the tests pass. Rejected because the stated goal is
  to practise DDD, and a model whose illegal states are representable is the
  part that is still missing.
