import { eq } from "drizzle-orm";
import type { Database } from "../../shared/db/database.js";
import { sessions } from "../../shared/db/schema/sessions.js";
import type {
  CreateSessionInput,
  SessionRepository,
} from "./session.repository.js";

/**
 * Postgres adapter for {@link SessionRepository} (Repository pattern, ADR 0014).
 * A factory over an injected {@link Database} (ADR 0026/0027), integration-tested
 * against a real Postgres (ADR 0015).
 */
export function createPostgresSessionRepository(
  db: Database,
): SessionRepository {
  return {
    async create(input: CreateSessionInput) {
      const [session] = await db.insert(sessions).values(input).returning();

      if (session === undefined) {
        throw new Error("create: expected a returned session row");
      }

      return session;
    },

    async findById(id) {
      const [session] = await db
        .select()
        .from(sessions)
        .where(eq(sessions.id, id))
        .limit(1);

      return session ?? null;
    },

    async deleteById(id) {
      await db.delete(sessions).where(eq(sessions.id, id));
    },
  };
}
