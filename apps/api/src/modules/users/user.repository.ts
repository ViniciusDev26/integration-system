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

/** Data to create an account that signs in with a password (ADR 0043). */
export interface CreatePasswordUserInput {
  email: string;
  name: string | null;
  /** Already hashed — the repository never sees a plaintext password. */
  passwordHash: string;
}

/** The GitHub profile to attach to an account that did not have one. */
export interface LinkGithubInput {
  userId: string;
  githubId: string;
  name: string | null;
  imageUrl: string | null;
}

/**
 * Port for user persistence (ADR 0014, ADR 0027). Adapters implement it:
 * `createPostgresUserRepository` (production) and an in-memory fake (tests).
 */
export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByGithubId(githubId: string): Promise<User | null>;
  /** Lookup by the address someone types at the login form (ADR 0043). */
  findByEmail(email: string): Promise<User | null>;
  upsertByGithubId(input: UpsertUserInput): Promise<User>;
  /** Creates a password-only account. `github_id` stays null. */
  createWithPassword(input: CreatePasswordUserInput): Promise<User>;
  /**
   * Attaches a GitHub identity to an existing account — used when GitHub login
   * arrives at an address that already has a password account, which is safe
   * because GitHub only gives us verified addresses (ADR 0043).
   */
  linkGithub(input: LinkGithubInput): Promise<User>;
}
