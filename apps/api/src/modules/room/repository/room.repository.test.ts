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
import type { RoomRepository } from "./room.repository.js";
import { createPostgresRoomRepository } from "./room.repository.postgres.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("RoomRepository", () => {
  let testDb: TestDatabase;
  let db: Database;
  let repository: RoomRepository;
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
      sql`truncate table room_musics, room_members, rooms, invites, playlist_musics, playlist_members, playlists, musics, sessions, users restart identity cascade`,
    );
    repository = createPostgresRoomRepository(db);
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

  it("creates a room, makes the creator OWNER, and starts paused at zero", async () => {
    const room = await repository.create({ name: "Friday", ownerId });

    expect(room.id).toMatch(UUID_V7);
    expect(room.name).toBe("Friday");
    expect(room.currentMusicId).toBeNull();
    expect(room.positionMs).toBe(0);
    expect(room.isPlaying).toBe(false);
    expect(await repository.getMemberType(room.id, ownerId)).toBe("OWNER");
  });

  it("finds a room by id and returns null for an unknown id", async () => {
    const room = await repository.create({ name: "Friday", ownerId });

    expect((await repository.findById(room.id))?.name).toBe("Friday");
    expect(
      await repository.findById("0192f1a0-0000-7000-8000-00000000dead"),
    ).toBeNull();
  });

  it("lists rooms the user belongs to, newest first", async () => {
    const first = await repository.create({ name: "First", ownerId });
    const second = await repository.create({ name: "Second", ownerId });
    await repository.create({ name: "Theirs", ownerId: otherId });

    expect((await repository.listForMember(ownerId)).map((r) => r.id)).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("includes a room the user was added to as MEMBER", async () => {
    const room = await repository.create({ name: "Shared", ownerId });

    expect(
      await repository.addMember({
        roomId: room.id,
        userId: otherId,
        type: "MEMBER",
      }),
    ).toBe(true);

    expect((await repository.listForMember(otherId)).map((r) => r.id)).toEqual([
      room.id,
    ]);
  });

  it("reports a repeated join and keeps the original role", async () => {
    const room = await repository.create({ name: "Shared", ownerId });

    expect(
      await repository.addMember({
        roomId: room.id,
        userId: ownerId,
        type: "MEMBER",
      }),
    ).toBe(false);
    expect(await repository.getMemberType(room.id, ownerId)).toBe("OWNER");
  });

  it("lists members with role and profile, in join order", async () => {
    const room = await repository.create({ name: "Shared", ownerId });
    await repository.addMember({
      roomId: room.id,
      userId: otherId,
      type: "MEMBER",
    });

    expect(await repository.listMembers(room.id)).toEqual([
      { userId: ownerId, type: "OWNER", name: "Owner", imageUrl: null },
      { userId: otherId, type: "MEMBER", name: "Other", imageUrl: null },
    ]);
  });

  it("queues tracks in order and ignores duplicates", async () => {
    const room = await repository.create({ name: "Friday", ownerId });
    const first = await seedMusic("first");
    const second = await seedMusic("second");

    await repository.addMusic({ roomId: room.id, musicId: first });
    await repository.addMusic({ roomId: room.id, musicId: second });
    await repository.addMusic({ roomId: room.id, musicId: first });

    expect((await repository.listMusics(room.id)).map((m) => m.id)).toEqual([
      first,
      second,
    ]);
  });

  it("writes the playback anchor", async () => {
    const room = await repository.create({ name: "Friday", ownerId });
    const musicId = await seedMusic("track");
    const at = new Date("2026-10-02T12:00:00.000Z");

    const updated = await repository.setPlayback(room.id, {
      currentMusicId: musicId,
      positionMs: 42_000,
      isPlaying: true,
      playbackUpdatedAt: at,
    });

    expect(updated?.currentMusicId).toBe(musicId);
    expect(updated?.positionMs).toBe(42_000);
    expect(updated?.isPlaying).toBe(true);
    expect(updated?.playbackUpdatedAt.getTime()).toBe(at.getTime());
  });

  it("returns null when anchoring an unknown room", async () => {
    expect(
      await repository.setPlayback("0192f1a0-0000-7000-8000-00000000beef", {
        currentMusicId: null,
        positionMs: 0,
        isPlaying: false,
        playbackUpdatedAt: new Date(),
      }),
    ).toBeNull();
  });

  it("rejects a negative position, via the check constraint", async () => {
    const room = await repository.create({ name: "Friday", ownerId });

    await expect(
      repository.setPlayback(room.id, {
        currentMusicId: null,
        positionMs: -1,
        isPlaying: false,
        playbackUpdatedAt: new Date(),
      }),
    ).rejects.toThrow();
  });

  it("keeps the room when its current track is deleted, clearing the anchor", async () => {
    const room = await repository.create({ name: "Friday", ownerId });
    const musicId = await seedMusic("doomed");
    await repository.setPlayback(room.id, {
      currentMusicId: musicId,
      positionMs: 1000,
      isPlaying: true,
      playbackUpdatedAt: new Date(),
    });

    await db.execute(sql`delete from musics where id = ${musicId}`);

    const found = await repository.findById(room.id);
    expect(found).not.toBeNull();
    expect(found?.currentMusicId).toBeNull();
  });

  it("cascades: deleting the room removes its members and queued tracks", async () => {
    const room = await repository.create({ name: "Friday", ownerId });
    await repository.addMember({
      roomId: room.id,
      userId: otherId,
      type: "MEMBER",
    });
    await repository.addMusic({
      roomId: room.id,
      musicId: await seedMusic("track"),
    });

    await db.execute(sql`delete from rooms where id = ${room.id}`);

    expect(await repository.listMembers(room.id)).toEqual([]);
    expect(await repository.listMusics(room.id)).toEqual([]);
  });
});
