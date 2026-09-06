import { eq } from "drizzle-orm";
import type { Database } from "../../shared/db/database.js";
import { users } from "../../shared/db/schema/users.js";
import type { UserRepository } from "./user.repository.js";

/**
 * Postgres adapter for {@link UserRepository} — the only code that reads/writes
 * the `users` table via Drizzle (Repository pattern, ADR 0014). A factory taking
 * an injected {@link Database} (ADR 0026/0027), integration-tested against a real
 * Postgres (ADR 0015).
 */
export function createPostgresUserRepository(db: Database): UserRepository {
  return {
    async findById(id) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      return user ?? null;
    },

    async findByGithubId(githubId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.githubId, githubId))
        .limit(1);

      return user ?? null;
    },

    async upsertByGithubId(input) {
      const [user] = await db
        .insert(users)
        .values(input)
        .onConflictDoUpdate({
          target: users.githubId,
          set: {
            name: input.name,
            email: input.email,
            imageUrl: input.imageUrl,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (user === undefined) {
        throw new Error("upsertByGithubId: expected a returned user row");
      }

      return user;
    },
  };
}
