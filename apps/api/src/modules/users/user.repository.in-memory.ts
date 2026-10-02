import type { User } from "../../shared/db/schema/users.js";
import type { UpsertUserInput, UserRepository } from "./user.repository.js";

/**
 * In-memory fake of {@link UserRepository} for unit-testing services
 * (ADR 0022/0027). Not shipped in the build.
 */
export function createInMemoryUserRepository(): UserRepository {
  const usersById = new Map<string, User>();
  let sequence = 0;

  function findByGithubId(githubId: string): User | null {
    for (const user of usersById.values()) {
      if (user.githubId === githubId) {
        return user;
      }
    }
    return null;
  }

  return {
    async findById(id) {
      return usersById.get(id) ?? null;
    },

    async findByGithubId(githubId) {
      return findByGithubId(githubId);
    },

    async findByEmail(email) {
      for (const user of usersById.values()) {
        if (user.email === email) {
          return user;
        }
      }
      return null;
    },

    async createWithPassword(input) {
      sequence += 1;
      const now = new Date();
      const user: User = {
        id: `user-${sequence}`,
        githubId: null,
        name: input.name,
        email: input.email,
        passwordHash: input.passwordHash,
        imageUrl: null,
        createdAt: now,
        updatedAt: now,
      };
      usersById.set(user.id, user);
      return user;
    },

    async linkGithub(input) {
      const existing = usersById.get(input.userId);
      if (existing === undefined) {
        throw new Error(`linkGithub: unknown user ${input.userId}`);
      }
      const updated: User = {
        ...existing,
        githubId: input.githubId,
        name: existing.name ?? input.name,
        imageUrl: existing.imageUrl ?? input.imageUrl,
        updatedAt: new Date(),
      };
      usersById.set(updated.id, updated);
      return updated;
    },

    async upsertByGithubId(input: UpsertUserInput) {
      const now = new Date();
      const existing = findByGithubId(input.githubId);

      if (existing !== null) {
        const updated: User = {
          ...existing,
          name: input.name,
          email: input.email,
          imageUrl: input.imageUrl,
          updatedAt: now,
        };
        usersById.set(updated.id, updated);
        return updated;
      }

      sequence += 1;
      const user: User = {
        id: `user-${sequence}`,
        githubId: input.githubId,
        name: input.name,
        email: input.email,
        passwordHash: null,
        imageUrl: input.imageUrl,
        createdAt: now,
        updatedAt: now,
      };
      usersById.set(user.id, user);
      return user;
    },
  };
}
