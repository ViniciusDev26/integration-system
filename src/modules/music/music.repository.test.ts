import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "../../container-test.js";
import type { Database } from "../../shared/db/database.js";
import type { UserRepository } from "../users/user.repository.js";
import { createPostgresUserRepository } from "../users/user.repository.postgres.js";
import type { MusicRepository } from "./music.repository.js";
import { createPostgresMusicRepository } from "./music.repository.postgres.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("MusicRepository", () => {
  let testDb: TestDatabase;
  let db: Database;
  let repository: MusicRepository;
  let users: UserRepository;
  let uploaderId: string;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table musics, sessions, users restart identity cascade`,
    );
    repository = createPostgresMusicRepository(db);
    users = createPostgresUserRepository(db);
    const uploader = await users.upsertByGithubId({
      githubId: "42",
      name: "Ada",
      email: "ada@example.com",
      imageUrl: null,
    });
    uploaderId = uploader.id;
  });

  function input(overrides: Partial<{ name: string; genre: string }> = {}) {
    return {
      name: overrides.name ?? "Nocturne",
      genre: overrides.genre ?? "classical",
      objectKey: "musics/abc.mp3",
      uploadedBy: uploaderId,
    };
  }

  it("creates a music row and returns it with a generated UUIDv7 id", async () => {
    const music = await repository.create(input());

    expect(music.id).toMatch(UUID_V7);
    expect(music.name).toBe("Nocturne");
    expect(music.genre).toBe("classical");
    expect(music.objectKey).toBe("musics/abc.mp3");
    expect(music.uploadedBy).toBe(uploaderId);
    expect(music.createdAt).toBeInstanceOf(Date);
  });

  it("finds a music by id", async () => {
    const created = await repository.create(input());

    const found = await repository.findById(created.id);

    expect(found?.id).toBe(created.id);
    expect(found?.name).toBe("Nocturne");
  });

  it("returns null when the id is unknown", async () => {
    expect(
      await repository.findById("01920000-0000-7000-8000-000000000000"),
    ).toBeNull();
  });

  it("lists all musics newest-first", async () => {
    const first = await repository.create(input({ name: "First" }));
    const second = await repository.create(input({ name: "Second" }));

    const all = await repository.list();

    expect(all).toHaveLength(2);
    expect(all.map((m) => m.id)).toEqual([second.id, first.id]);
  });

  it("cascades: deleting the uploader removes their musics", async () => {
    await repository.create(input());

    await db.execute(sql`delete from users`);

    expect(await repository.list()).toHaveLength(0);
  });
});
