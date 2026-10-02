import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "../../container-test.js";
import type { Database } from "../../shared/db/database.js";
import { users } from "../../shared/db/schema/users.js";
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

describe("UserRepository — password credentials (ADR 0043)", () => {
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
    await db.execute(sql`truncate table users restart identity cascade`);
    repository = createPostgresUserRepository(db);
  });

  it("creates a password account with no github id", async () => {
    const user = await repository.createWithPassword({
      email: "grace@example.com",
      name: "Grace",
      passwordHash: "argon2-hash",
    });

    expect(user.id).toMatch(UUID_V7);
    expect(user.githubId).toBeNull();
    expect(user.passwordHash).toBe("argon2-hash");
  });

  it("finds an account by email, and returns null otherwise", async () => {
    await repository.createWithPassword({
      email: "grace@example.com",
      name: "Grace",
      passwordHash: "argon2-hash",
    });

    expect((await repository.findByEmail("grace@example.com"))?.name).toBe(
      "Grace",
    );
    expect(await repository.findByEmail("nobody@example.com")).toBeNull();
  });

  it("refuses a second account with the same email", async () => {
    await repository.createWithPassword({
      email: "grace@example.com",
      name: "Grace",
      passwordHash: "hash-1",
    });

    await expect(
      repository.createWithPassword({
        email: "grace@example.com",
        name: "Impostor",
        passwordHash: "hash-2",
      }),
    ).rejects.toThrow();
  });

  it("links a GitHub identity onto a password account", async () => {
    const created = await repository.createWithPassword({
      email: "grace@example.com",
      name: "Grace",
      passwordHash: "argon2-hash",
    });

    const linked = await repository.linkGithub({
      userId: created.id,
      githubId: "gh-grace",
      name: "Grace From GitHub",
      imageUrl: "https://avatars.example/grace.png",
    });

    expect(linked.githubId).toBe("gh-grace");
    // The password still works — linking adds a credential, it does not replace.
    expect(linked.passwordHash).toBe("argon2-hash");
    // A name chosen at registration is not overwritten by the GitHub one.
    expect(linked.name).toBe("Grace");
    // A field the account lacked does get filled in.
    expect(linked.imageUrl).toBe("https://avatars.example/grace.png");
  });

  it("rejects an account with neither credential, via the check constraint", async () => {
    await expect(
      db.execute(sql`insert into users (email) values ('nobody@example.com')`),
    ).rejects.toThrow();
  });

  it("allows an account with only a github id", async () => {
    const user = await repository.upsertByGithubId({
      githubId: "gh-only",
      name: "OAuth Only",
      email: "oauth@example.com",
      imageUrl: null,
    });

    expect(user.passwordHash).toBeNull();
    expect(user.githubId).toBe("gh-only");
  });
});
