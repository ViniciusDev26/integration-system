# 0026. Prefer factory functions (closures) over classes

- Status: Accepted
- Date: 2026-09-05

## Context

Repositories, services, and controllers mostly capture dependencies and expose
behavior; they have no inheritance and no mutable identity that classes model
well. Classes in TypeScript also bring `this`/binding friction and invite
decorator/DI-container magic we want to avoid (see ADR 0027, ADR 0009).

## Decision

Implement repositories, services, and controllers as **factory functions that
return an object of methods** (closures capturing their dependencies), not
classes. Export the shape as a **type** (a port interface, ADR 0027, or
`ReturnType<typeof createX>`).

```ts
export function createPostgresUserRepository(db: Database): UserRepository {
  return {
    findById: async (id) => { /* uses db */ },
    upsertByGithubId: async (input) => { /* uses db */ },
  };
}
```

## Consequences

- No `this`/binding pitfalls; methods are plain closures.
- Dependencies are explicit constructor-style arguments to the factory, which
  pairs naturally with manual dependency injection (ADR 0027).
- Fakes/alternate implementations are just other factories returning the same
  type — trivial to write for tests.
- Class-based DI containers (tsyringe, Inversify) become inapplicable — an
  accepted trade, consistent with ADR 0027.
- Classes remain acceptable where genuinely warranted (e.g. custom `Error`
  subclasses, or when a library requires them); this rule targets the
  repository/service/controller layers.

## Alternatives considered

- **Classes** (`class UserRepository { constructor(db) {} }`): conventional and
  enable decorator DI, but bring `this`/binding overhead and pull toward
  reflect-metadata magic. Rejected as the default for these layers.
