import { eq } from "drizzle-orm";
import type { Database } from "../../shared/db/database.js";
import { type User, users } from "../../shared/db/schema/users.js";

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
 * The only code that reads/writes the `users` table via Drizzle (Repository
 * pattern, ADR 0014). Depends on an injected {@link Database} so it can be
 * integration-tested against a real Postgres (ADR 0015) or wired to the
 * production client.
 */
export class UserRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user ?? null;
  }

  async findByGithubId(githubId: string): Promise<User | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.githubId, githubId))
      .limit(1);

    return user ?? null;
  }

  async upsertByGithubId(input: UpsertUserInput): Promise<User> {
    const [user] = await this.db
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
  }
}
