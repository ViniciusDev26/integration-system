import type { Session } from "../../shared/db/schema/sessions.js";
import type {
  CreateSessionInput,
  SessionRepository,
} from "./session.repository.js";

/**
 * In-memory fake of {@link SessionRepository} for unit-testing the layers above
 * the database (ADR 0022/0027). Not shipped in the build (excluded via
 * tsconfig.build.json).
 */
export function createInMemorySessionRepository(): SessionRepository {
  const store = new Map<string, Session>();

  return {
    async create(input: CreateSessionInput) {
      const session: Session = {
        id: input.id,
        userId: input.userId,
        expiresAt: input.expiresAt,
        createdAt: new Date(),
      };
      store.set(session.id, session);
      return session;
    },

    async findById(id) {
      return store.get(id) ?? null;
    },

    async deleteById(id) {
      store.delete(id);
    },
  };
}
