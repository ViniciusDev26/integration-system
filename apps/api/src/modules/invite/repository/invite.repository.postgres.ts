import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "../../../shared/db/database.js";
import { invites } from "../../../shared/db/schema/invites.js";
import type {
  CreateInviteInput,
  InviteRepository,
  ResourceRef,
} from "./invite.repository.js";

/**
 * Postgres adapter for {@link InviteRepository} (ADR 0040, ADR 0014). A factory
 * over an injected {@link Database} (ADR 0026/0027), integration-tested against
 * a real Postgres (ADR 0015).
 */
export function createPostgresInviteRepository(db: Database): InviteRepository {
  return {
    async create(input: CreateInviteInput) {
      const [invite] = await db.insert(invites).values(input).returning();

      if (invite === undefined) {
        throw new Error("create: expected a returned invite row");
      }

      return invite;
    },

    async findById(id) {
      const [invite] = await db
        .select()
        .from(invites)
        .where(eq(invites.id, id))
        .limit(1);

      return invite ?? null;
    },

    async findByToken(token) {
      const [invite] = await db
        .select()
        .from(invites)
        .where(eq(invites.token, token))
        .limit(1);

      return invite ?? null;
    },

    async listForResource(ref: ResourceRef) {
      return db
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.resourceType, ref.resourceType),
            eq(invites.resourceId, ref.resourceId),
          ),
        )
        .orderBy(desc(invites.createdAt), desc(invites.id));
    },

    async revoke(id, revokedAt) {
      // `isNull` keeps the first revocation: re-revoking must not move the
      // timestamp, so a second call matches no row.
      await db
        .update(invites)
        .set({ revokedAt })
        .where(and(eq(invites.id, id), isNull(invites.revokedAt)));
    },
  };
}
