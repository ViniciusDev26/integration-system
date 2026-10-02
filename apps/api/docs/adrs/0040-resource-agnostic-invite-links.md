# 0040. Resource-agnostic invite links

- Status: Accepted
- Date: 2026-10-02

## Context

Shared playlists are the first AV3 feature, and they cannot exist without a way
to add a second member: today a playlist has exactly one `OWNER` row and no path
to a `MEMBER` one. Rooms, later in the same epic, need the identical thing —
create a resource, invite people into it — so the mechanism should be built once
and reused, not written twice.

Two facts about the current code constrain how an invitee can be named:

- `UserRepository` exposes only `findById` and `findByGithubId`. There is no
  user search, and adding one means adding a surface where any authenticated
  user can enumerate others.
- The GitHub `login` is **deliberately discarded** by the OAuth mapping
  (ADR 0020). The only human-usable identifier stored is the email.

Membership itself is already modelled the right way: `playlist_members` is a
relation with `type` OWNER|MEMBER, and `MEMBER` was reserved from the start for
exactly this (ADR 0018). Nothing in the schema has to change for a playlist to
have members.

## Decision

An invite is an **opaque token that addresses a `(resource_type, resource_id)`
pair**. Whoever is authenticated and redeems the token becomes a `MEMBER` of
that resource.

- A new `invites` table, **polymorphic**: `resource_type` (checked) plus a
  `resource_id` that carries **no foreign key**, because it may point at a
  playlist today and a room tomorrow.
- A module `src/modules/invite/` that knows nothing about playlists or rooms.
  What it knows is a port:

  ```ts
  interface ResourceMembership {
    exists(resourceId: string): Promise<boolean>;
    canInvite(resourceId: string, userId: string): Promise<boolean>;
    grant(resourceId: string, userId: string): Promise<void>;
  }
  ```

  One adapter per resource type, registered **by type** in the composition root
  (ADR 0027). Playlist now; room later, with no change to the invite module.
- **Only an `OWNER` may invite**, and redeeming grants **`MEMBER`** — the two
  roles the schema already has.
- The token is `randomBytes(32).toString("base64url")`, the same construction as
  session ids (ADR 0016), with the generator injectable so tests are
  deterministic.
- Invites **expire** on a default TTL and are **revocable**. A link is
  **reusable** until then: several people may redeem the same one, and who
  accepted is recorded by the membership row, not on the invite.
- `PlaylistRepository` gains `addMember`, and owner-scoped listing becomes
  membership-scoped, so a shared playlist appears for the person invited.

## Consequences

- **Rooms are a registration, not a rewrite.** Adding them means one more
  `ResourceMembership` adapter and one more allowed `resource_type`. This is the
  whole point of the decision.
- **No user search, no invite inbox, no email delivery.** Nothing has to know
  who the invitee is before they arrive, which keeps a user-enumeration surface
  out of the API entirely.
- **The token is a bearer credential.** Anyone holding the link can join while
  it is live, so expiry and revocation are the only controls — there is no
  per-person targeting to fall back on. Links should be treated like passwords
  when shared.
- **A polymorphic `resource_id` has no referential integrity.** Deleting a
  playlist leaves its invites behind. They are inert, because redeeming checks
  the resource still exists, but they accumulate and will want a sweep — the
  same unresolved shape as expired `sessions` (ADR 0019).
- **Owner-scoped listing changes meaning.** `listByOwner` becomes a
  membership-scoped list, so playlists you were invited to show up alongside
  those you created. Callers that assumed "mine = created by me" change with it.
- No per-link use counter and no per-person invite state. Neither is needed for
  the features in the AV3 epic; adding either later does not invalidate this.

## Alternatives considered

- **Invite by email.** The email is unique and required, so it identifies a user
  without new schema. Rejected because it only works for someone who has already
  logged in at least once — inviting a newcomer needs a pending invite claimed
  at first login, which is a second mechanism — and because it forces a
  `findByEmail` lookup that doubles as an account-existence oracle. It also
  needs per-person invite state (PENDING/ACCEPTED/DECLINED) and somewhere to
  display it, none of which the token approach requires.

- **Invite by GitHub username.** The most natural thing to type, and the one a
  user would expect. Rejected on cost: `login` is discarded today, so this needs
  a migration, a change to the OAuth adapter's mapping, and a backfill for
  existing rows — before any of the actual feature gets written.

- **A table per resource (`playlist_invites`, `room_invites`).** Keeps real
  foreign keys and cascade deletes, which the chosen design gives up. Rejected
  because it duplicates the schema, the repository, and the service for every
  resource type — precisely the duplication this decision exists to avoid. The
  integrity lost is recoverable by checking existence on redeem, which is
  required anyway since an invite outlives nothing.

- **Overload `playlist_members` with a PENDING state.** No new table at all.
  Rejected because it fills the membership relation with rows that are not
  memberships, forcing every existing membership query to filter, and because it
  would have to be generalized for rooms regardless.
