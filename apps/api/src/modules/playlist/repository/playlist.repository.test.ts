import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../../container-test.js";
import type { Database } from "../../../shared/db/database.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import { createPostgresMusicRepository } from "../../music/repository/music.repository.postgres.js";
import type { UserRepository } from "../../users/user.repository.js";
import { createPostgresUserRepository } from "../../users/user.repository.postgres.js";
import type { PlaylistRepository } from "./playlist.repository.js";
import { createPostgresPlaylistRepository } from "./playlist.repository.postgres.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("PlaylistRepository", () => {
  let testDb: TestDatabase;
  let db: Database;
  let repository: PlaylistRepository;
  let users: UserRepository;
  let musicRepo: MusicRepository;
  let ownerId: string;
  let otherId: string;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table playlist_musics, playlist_members, playlists, musics, sessions, users restart identity cascade`,
    );
    repository = createPostgresPlaylistRepository(db);
    users = createPostgresUserRepository(db);
    musicRepo = createPostgresMusicRepository(db);

    const owner = await users.upsertByGithubId({
      githubId: "owner",
      name: "Owner",
      email: "owner@example.com",
      imageUrl: null,
    });
    ownerId = owner.id;
    const other = await users.upsertByGithubId({
      githubId: "other",
      name: "Other",
      email: "other@example.com",
      imageUrl: null,
    });
    otherId = other.id;
  });

  async function seedMusic(name: string): Promise<string> {
    const music = await musicRepo.create({
      name,
      genres: ["pop"],
      objectKey: `musics/${name}.mp3`,
      thumbnailObjectKey: null,
      uploadedBy: ownerId,
    });
    return music.id;
  }

  it("creates a playlist and makes the creator its OWNER", async () => {
    const playlist = await repository.create({
      name: "Road trip",
      ownerId,
    });

    expect(playlist.id).toMatch(UUID_V7);
    expect(playlist.name).toBe("Road trip");
    expect(await repository.getMemberType(playlist.id, ownerId)).toBe("OWNER");
    expect(await repository.getMemberType(playlist.id, otherId)).toBeNull();
  });

  it("finds a playlist by id and returns null for an unknown id", async () => {
    const created = await repository.create({ name: "Chill", ownerId });

    expect((await repository.findById(created.id))?.name).toBe("Chill");
    expect(
      await repository.findById("01920000-0000-7000-8000-000000000000"),
    ).toBeNull();
  });

  it("lists only playlists the user owns, newest first", async () => {
    const first = await repository.create({ name: "First", ownerId });
    const second = await repository.create({ name: "Second", ownerId });
    await repository.create({ name: "Theirs", ownerId: otherId });

    const owned = await repository.listByOwner(ownerId);

    expect(owned.map((p) => p.id)).toEqual([second.id, first.id]);
  });

  it("adds tracks (in order) and ignores duplicates", async () => {
    const playlist = await repository.create({ name: "Mix", ownerId });
    const a = await seedMusic("A");
    const b = await seedMusic("B");

    await repository.addMusic({ playlistId: playlist.id, musicId: a });
    await repository.addMusic({ playlistId: playlist.id, musicId: b });
    await repository.addMusic({ playlistId: playlist.id, musicId: a }); // dup

    const tracks = await repository.listMusics(playlist.id);
    expect(tracks.map((m) => m.name)).toEqual(["A", "B"]);
  });

  it("cascades: deleting the playlist removes its members and links", async () => {
    const playlist = await repository.create({ name: "Temp", ownerId });
    await repository.addMusic({
      playlistId: playlist.id,
      musicId: await seedMusic("A"),
    });

    await db.execute(sql`delete from playlists`);

    const memberRows = await db.execute(
      sql`select count(*)::int as count from playlist_members`,
    );
    const linkRows = await db.execute(
      sql`select count(*)::int as count from playlist_musics`,
    );
    expect(Number(memberRows[0]?.count)).toBe(0);
    expect(Number(linkRows[0]?.count)).toBe(0);
  });
});
