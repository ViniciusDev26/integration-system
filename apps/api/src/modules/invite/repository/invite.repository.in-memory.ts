import { randomUUID } from "node:crypto";
import type { Invite } from "../domain/invite.js";
import { inviteTokenFrom } from "../domain/invite-token.js";
import type { ResourceRef } from "../domain/resource.js";
import type {
  CreateInviteInput,
  InviteRepository,
} from "./invite.repository.js";

/**
 * In-memory {@link InviteRepository} for unit tests (ADR 0027). Mirrors the
 * Postgres adapter's observable behaviour: tokens are unique, listing is
 * newest-first and scoped to one resource, and re-revoking keeps the first
 * timestamp.
 */
export function createInMemoryInviteRepository(): InviteRepository {
  const rows: Invite[] = [];

  return {
    async create(input: CreateInviteInput) {
      if (rows.some((row) => row.token === input.token)) {
        throw new Error(`invite token already exists: ${input.token}`);
      }

      const invite: Invite = {
        id: randomUUID(),
        token: inviteTokenFrom(input.token),
        resource: {
          resourceType: input.resourceType,
          resourceId: input.resourceId,
        },
        createdBy: input.createdBy,
        createdAt: new Date(),
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      rows.push(invite);
      return invite;
    },

    async findById(id) {
      return rows.find((row) => row.id === id) ?? null;
    },

    async findByToken(token) {
      return rows.find((row) => row.token === token) ?? null;
    },

    async listForResource(ref: ResourceRef) {
      return rows
        .filter(
          (row) =>
            row.resource.resourceType === ref.resourceType &&
            row.resource.resourceId === ref.resourceId,
        )
        .reverse();
    },

    async revoke(id, revokedAt) {
      const index = rows.findIndex((row) => row.id === id);
      const invite = rows[index];
      if (invite === undefined || invite.revokedAt !== null) {
        return;
      }
      // The entity is readonly, so revoking replaces it rather than mutating.
      rows[index] = { ...invite, revokedAt };
    },
  };
}
