import { randomUUID } from "node:crypto";
import type { Invite } from "../../../shared/db/schema/invites.js";
import type {
  CreateInviteInput,
  InviteRepository,
  ResourceRef,
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
        token: input.token,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        createdBy: input.createdBy,
        expiresAt: input.expiresAt,
        revokedAt: null,
        createdAt: new Date(),
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
            row.resourceType === ref.resourceType &&
            row.resourceId === ref.resourceId,
        )
        .reverse();
    },

    async revoke(id, revokedAt) {
      const invite = rows.find((row) => row.id === id);
      if (invite === undefined || invite.revokedAt !== null) {
        return;
      }
      invite.revokedAt = revokedAt;
    },
  };
}
