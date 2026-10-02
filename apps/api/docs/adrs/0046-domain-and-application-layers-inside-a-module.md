# 0046. Domain and application layers inside a module

- Status: Accepted
- Date: 2026-10-02
- Extends: [0018](./0018-feature-modular-architecture.md)

## Context

ADR 0018 chose feature-modular vertical slices and deliberately stopped short of
DDD, on the grounds that a CRUD-ish domain would yield an anemic model. It named
the condition for revisiting: *"when the playlist feature grows real invariants
(e.g. shared / collaborative playlists), reassess and migrate toward hexagonal +
DDD incrementally, per module."*

That condition has been met. The AV3 epic added shared playlists, rooms with
synchronized playback, invites with expiry and revocation, and chat with replay.
There are now rules worth isolating.

Two observations shaped this decision more than any principle.

**The target already exists in the codebase.** `room.playback.ts` is 78 lines,
two pure functions, no I/O, and its 175 lines of tests use no fake, no clock and
no database — `now` is a parameter. It decides how an anchor moves when someone
plays, pauses, seeks or changes track. That is a domain module; it was simply
built that way without being called one.

**And the tangle it contrasts with also exists.** `invite.service.ts` interleaves
both kinds of decision in one function:

```ts
if (invite.revokedAt !== null)                       throw InviteRevokedError   // a fact about an invite
if (invite.expiresAt.getTime() <= now().getTime())   throw InviteExpiredError   // a fact about an invite
if (!(await membership.exists(resourceId)))          throw ResourceNotFound     // a question for a port
if (!(await membership.canInvite(resourceId, user))) throw InviteForbidden      // a question for a port
```

The first two hold regardless of where an invite is stored or how it arrived.
The last two are orchestration.

## Decision

Inside a module **that has real invariants**, separate two layers:

- **`domain/`** — pure. No `await` on a port or repository, no Express, Drizzle
  or tRPC types, no injected clock: a time-dependent rule takes `now` as an
  argument. It answers questions *about the thing itself*.
- **`application/`** — orchestration. Loads through ports, asks the domain,
  persists, publishes events, and maps failures to the module's typed errors.

`repository/`, `http/`, `oauth/` and the rest stay what ADR 0018 made them:
adapters at the edges. Vertical slices stay; this refines what lives inside one.

### The test for "is this domain?"

> Can it be decided from the data already in hand plus, at most, a timestamp —
> without awaiting anything?

If yes, it belongs in `domain/`. If it needs to go and look something up, it is
application.

### Not every module gets a `domain/` folder

`media/` makes four decisions — is there a session, are the params present, does
the track exist, does it have a cover — and every one is a guard, not an
invariant. Giving it a domain layer would produce an empty one, and an empty
domain layer is worse than none: it becomes a pattern to copy, and the copies
are anemic pass-through.

**A `domain/` folder appears when there is a rule that survives both the
transport and the database changing.** Modules without such a rule stay as they
are.

### Migration is incremental

Per module, as ADR 0018 planned, not as a sweep. **Invites first** — the
smallest module with genuine rules, and one that already has a port
(`ResourceMembership`), so the seam exists. Rooms are already half-way there and
need only the folder. Media is explicitly excluded.

## Consequences

- **Domain tests need no fakes at all.** `room.playback.test.ts` is the standard:
  construct a value, call a function, assert. No container, no in-memory
  repository, no clock injection. That is the clearest signal the split landed.
- **Some logic moves out of services**, which get shorter and read as a
  sequence of steps rather than a mixture of steps and rules.
- **Two more concepts to learn** in a codebase that already has ports, adapters
  and a composition root. The "is this domain?" test above exists so the answer
  is mechanical rather than a matter of taste.
- **The split can be got wrong in both directions.** A rule left in the service
  keeps needing fakes to test; a port call dragged into `domain/` makes it
  impure and the folder stops meaning anything. Review is the backstop, as it is
  for ADR 0009's unsafe casts.
- **ADR 0018 is extended, not superseded.** Its module layout, boundary rules
  and inward dependency direction all still hold — what changes is that a module
  with invariants now says which of its code is which. Marking 0018 superseded
  would have implied the vertical slices were being replaced, which they are not.

## Alternatives considered

- **Full hexagonal/DDD across every module at once**, with entities, value
  objects and aggregates throughout. Rejected for the same reason ADR 0018
  rejected it originally and more concretely now: `media/`, `users/` and
  `sessions/` would gain ceremony and no rules. The split is worth its cost only
  where invariants exist.

- **Starting with `media/`**, the smallest and lowest-risk module. Rejected
  precisely because it is small for the wrong reason — it has no domain, so the
  pilot would demonstrate a folder structure without testing whether the
  separation helps, and would set an anemic example for the modules where it
  matters.

- **A single top-level `domain/` directory** shared by all modules, rather than
  one per module. Rejected as a return to organizing by technical type, which
  ADR 0018 rejected for scattering a feature across folders.

- **Leaving things as they are.** Defensible — the services work and are tested.
  Rejected because the tangle is already visible in `invite.service.ts`, and
  every rule that stays mixed with orchestration is a rule that can only be
  tested through a fake.
