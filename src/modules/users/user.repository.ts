import type { User } from "../../shared/db/schema/users.js";

/**
 * Data needed to create or update a user from a GitHub login (ADR 0020).
 * `githubId` is the stable upsert key; the rest is refreshed on each login.
 */
export interface UpsertUserInput {
  githubId: string;
  name: string | null;
  email: string;
  imageUrl: string | null;
}

/**
 * Port for user persistence (ADR 0014, ADR 0027). Adapters implement it:
 * `createPostgresUserRepository` (production) and an in-memory fake (tests).
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGithubId(githubId: string): Promise<User | null>;
  upsertByGithubId(input: UpsertUserInput): Promise<User>;
}
