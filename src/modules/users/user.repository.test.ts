import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Database } from "../../shared/db/database.js";
import { users } from "../../shared/db/schema/users.js";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../test-support/postgres.js";
import type { UserRepository } from "./user.repository.js";
import { createPostgresUserRepository } from "./user.repository.postgres.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const input = {
  githubId: "12345",
  name: "Ada Lovelace",
  email: "ada@example.com",
  imageUrl: "https://avatars.example/ada.png",
};

describe("UserRepository", () => {
  let testDb: TestDatabase;
  let db: Database;
  let repository: UserRepository;

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
    repository = createPostgresUserRepository(db);
  });

  it("creates a user via upsert and returns it with a generated UUIDv7 id", async () => {
    const user = await repository.upsertByGithubId(input);

    expect(user.id).toMatch(UUID_V7);
    expect(user.githubId).toBe(input.githubId);
    expect(user.name).toBe(input.name);
    expect(user.email).toBe(input.email);
    expect(user.imageUrl).toBe(input.imageUrl);
  });

  it("finds a user by github id", async () => {
    const created = await repository.upsertByGithubId(input);

    const found = await repository.findByGithubId(input.githubId);

    expect(found?.id).toBe(created.id);
  });

  it("returns null when the github id is unknown", async () => {
    expect(await repository.findByGithubId("does-not-exist")).toBeNull();
  });

  it("finds a user by id", async () => {
    const created = await repository.upsertByGithubId(input);

    const found = await repository.findById(created.id);

    expect(found?.email).toBe(input.email);
  });

  it("returns null when the id is unknown", async () => {
    expect(
      await repository.findById("01920000-0000-7000-8000-000000000000"),
    ).toBeNull();
  });

  it("upsert updates the existing user for the same github id (no duplicate)", async () => {
    const created = await repository.upsertByGithubId(input);

    const updated = await repository.upsertByGithubId({
      ...input,
      name: "Ada L.",
      email: "ada.new@example.com",
    });

    expect(updated.id).toBe(created.id);
    expect(updated.name).toBe("Ada L.");
    expect(updated.email).toBe("ada.new@example.com");

    const rows = await db.select().from(users);
    expect(rows).toHaveLength(1);
  });
});
