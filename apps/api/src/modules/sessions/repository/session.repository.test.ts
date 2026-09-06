import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../../container-test.js";
import type { Database } from "../../../shared/db/database.js";
import { users } from "../../../shared/db/schema/users.js";
import { createPostgresUserRepository } from "../../users/user.repository.postgres.js";
import type { SessionRepository } from "./session.repository.js";
import { createPostgresSessionRepository } from "./session.repository.postgres.js";

const userInput = {
  githubId: "42",
  name: "Grace Hopper",
  email: "grace@example.com",
  imageUrl: null,
};

const inOneHour = (): Date => new Date(Date.now() + 60 * 60 * 1000);

describe("SessionRepository (postgres)", () => {
  let testDb: TestDatabase;
  let db: Database;
  let repository: SessionRepository;
  let userId: string;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table sessions, users restart identity cascade`,
    );
    repository = createPostgresSessionRepository(db);
    const user =
      await createPostgresUserRepository(db).upsertByGithubId(userInput);
    userId = user.id;
  });

  it("creates a session and returns it", async () => {
    const expiresAt = inOneHour();

    const session = await repository.create({
      id: "sess_token_1",
      userId,
      expiresAt,
    });

    expect(session.id).toBe("sess_token_1");
    expect(session.userId).toBe(userId);
    expect(
      Math.abs(session.expiresAt.getTime() - expiresAt.getTime()),
    ).toBeLessThan(1000);
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it("finds a session by id", async () => {
    await repository.create({
      id: "sess_token_2",
      userId,
      expiresAt: inOneHour(),
    });

    const found = await repository.findById("sess_token_2");

    expect(found?.userId).toBe(userId);
  });

  it("returns null when the id is unknown", async () => {
    expect(await repository.findById("does-not-exist")).toBeNull();
  });

  it("deletes a session by id", async () => {
    await repository.create({
      id: "sess_token_3",
      userId,
      expiresAt: inOneHour(),
    });

    await repository.deleteById("sess_token_3");

    expect(await repository.findById("sess_token_3")).toBeNull();
  });

  it("cascades: deleting the user removes their sessions", async () => {
    await repository.create({
      id: "sess_token_4",
      userId,
      expiresAt: inOneHour(),
    });

    await db.delete(users).where(eq(users.id, userId));

    expect(await repository.findById("sess_token_4")).toBeNull();
  });
});
