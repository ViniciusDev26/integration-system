import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../../container-test.js";
import type { Database } from "../../../shared/db/database.js";
import type { UserRepository } from "../../users/user.repository.js";
import { createPostgresUserRepository } from "../../users/user.repository.postgres.js";
import type { RoomRepository } from "./room.repository.js";
import { createPostgresRoomRepository } from "./room.repository.postgres.js";
import type { RoomMessageRepository } from "./room-message.repository.js";
import { createPostgresRoomMessageRepository } from "./room-message.repository.postgres.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("RoomMessageRepository", () => {
  let testDb: TestDatabase;
  let db: Database;
  let messages: RoomMessageRepository;
  let roomRepo: RoomRepository;
  let users: UserRepository;
  let roomId: string;
  let authorId: string;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table room_messages, room_musics, room_members, rooms, invites, playlist_musics, playlist_members, playlists, musics, sessions, users restart identity cascade`,
    );
    messages = createPostgresRoomMessageRepository(db);
    roomRepo = createPostgresRoomRepository(db);
    users = createPostgresUserRepository(db);

    const author = await users.upsertByGithubId({
      githubId: "author",
      name: "Ada",
      email: "ada@example.com",
      imageUrl: "https://avatars.example/ada.png",
    });
    authorId = author.id;
    const room = await roomRepo.create({ name: "Friday", ownerId: authorId });
    roomId = room.id;
  });

  async function say(body: string) {
    return messages.create({ roomId, userId: authorId, body });
  }

  it("stores a message with its author's display fields", async () => {
    const message = await say("hello");

    expect(message.id).toMatch(UUID_V7);
    expect(message.body).toBe("hello");
    expect(message.userId).toBe(authorId);
    expect(message.authorName).toBe("Ada");
    expect(message.authorImageUrl).toBe("https://avatars.example/ada.png");
  });

  it("issues ids that sort by creation time", async () => {
    const first = await say("first");
    const second = await say("second");
    const third = await say("third");

    // The whole cursor scheme rests on this (ADR 0044).
    expect(first.id < second.id).toBe(true);
    expect(second.id < third.id).toBe(true);
  });

  it("lists recent messages oldest first", async () => {
    await say("one");
    await say("two");
    await say("three");

    const listed = await messages.listRecent(roomId, 10);

    expect(listed.map((m) => m.body)).toEqual(["one", "two", "three"]);
  });

  it("keeps the newest when the history is longer than the limit", async () => {
    for (const body of ["one", "two", "three", "four"]) {
      await say(body);
    }

    const listed = await messages.listRecent(roomId, 2);

    expect(listed.map((m) => m.body)).toEqual(["three", "four"]);
  });

  it("lists only messages after the cursor, oldest first", async () => {
    const first = await say("one");
    await say("two");
    await say("three");

    const after = await messages.listAfter({
      roomId,
      afterId: first.id,
      limit: 10,
    });

    expect(after.map((m) => m.body)).toEqual(["two", "three"]);
  });

  it("excludes the cursor message itself", async () => {
    const only = await say("only");

    const after = await messages.listAfter({
      roomId,
      afterId: only.id,
      limit: 10,
    });

    expect(after).toEqual([]);
  });

  it("keeps rooms apart", async () => {
    const other = await roomRepo.create({ name: "Other", ownerId: authorId });
    await say("mine");
    await messages.create({
      roomId: other.id,
      userId: authorId,
      body: "theirs",
    });

    expect((await messages.listRecent(roomId, 10)).map((m) => m.body)).toEqual([
      "mine",
    ]);
    expect(
      (await messages.listRecent(other.id, 10)).map((m) => m.body),
    ).toEqual(["theirs"]);
  });

  it("rejects an empty body and one past the maximum", async () => {
    await expect(say("")).rejects.toThrow();
    await expect(say("x".repeat(2001))).rejects.toThrow();
  });

  it("accepts a body at exactly the maximum", async () => {
    const message = await say("x".repeat(2000));

    expect(message.body).toHaveLength(2000);
  });

  it("deletes a room's messages along with the room", async () => {
    await say("hello");

    await db.execute(sql`delete from rooms where id = ${roomId}`);

    expect(await messages.listRecent(roomId, 10)).toEqual([]);
  });

  it("deletes an author's messages along with the account", async () => {
    await say("hello");

    await db.execute(sql`delete from users where id = ${authorId}`);

    expect(await messages.listRecent(roomId, 10)).toEqual([]);
  });
});
