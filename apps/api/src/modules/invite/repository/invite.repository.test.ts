import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  startTestDatabase,
  type TestDatabase,
} from "../../../container-test.js";
import type { Database } from "../../../shared/db/database.js";
import type { UserRepository } from "../../users/user.repository.js";
import { createPostgresUserRepository } from "../../users/user.repository.postgres.js";
import type { InviteRepository } from "./invite.repository.js";
import { createPostgresInviteRepository } from "./invite.repository.postgres.js";

const UUID_V7 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PLAYLIST_ID = "0192f1a0-0000-7000-8000-000000000001";
const OTHER_RESOURCE_ID = "0192f1a0-0000-7000-8000-000000000002";

function hourFromNow(): Date {
  return new Date(Date.now() + 60 * 60 * 1000);
}

describe("InviteRepository", () => {
  let testDb: TestDatabase;
  let db: Database;
  let repository: InviteRepository;
  let users: UserRepository;
  let inviterId: string;

  beforeAll(async () => {
    testDb = await startTestDatabase();
    db = testDb.db;
  });

  afterAll(async () => {
    await testDb.stop();
  });

  beforeEach(async () => {
    await db.execute(
      sql`truncate table invites, playlist_musics, playlist_members, playlists, musics, sessions, users restart identity cascade`,
    );
    repository = createPostgresInviteRepository(db);
    users = createPostgresUserRepository(db);

    const inviter = await users.upsertByGithubId({
      githubId: "inviter",
      name: "Inviter",
      email: "inviter@example.com",
      imageUrl: null,
    });
    inviterId = inviter.id;
  });

  it("creates an invite with a UUIDv7 id and the given fields", async () => {
    const expiresAt = hourFromNow();

    const invite = await repository.create({
      token: "tok-1",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt,
    });

    expect(invite.id).toMatch(UUID_V7);
    expect(invite.token).toBe("tok-1");
    expect(invite.resourceType).toBe("PLAYLIST");
    expect(invite.resourceId).toBe(PLAYLIST_ID);
    expect(invite.createdBy).toBe(inviterId);
    expect(invite.expiresAt.getTime()).toBe(expiresAt.getTime());
    expect(invite.revokedAt).toBeNull();
  });

  it("finds an invite by its token", async () => {
    const created = await repository.create({
      token: "tok-find",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });

    const found = await repository.findByToken("tok-find");

    expect(found?.id).toBe(created.id);
  });

  it("returns null for an unknown token", async () => {
    expect(await repository.findByToken("nope")).toBeNull();
  });

  it("finds an invite by id", async () => {
    const created = await repository.create({
      token: "tok-by-id",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });

    expect((await repository.findById(created.id))?.token).toBe("tok-by-id");
  });

  it("returns null for an unknown id", async () => {
    expect(
      await repository.findById("0192f1a0-0000-7000-8000-00000000dead"),
    ).toBeNull();
  });

  it("rejects a duplicate token", async () => {
    await repository.create({
      token: "tok-dup",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });

    await expect(
      repository.create({
        token: "tok-dup",
        resourceType: "PLAYLIST",
        resourceId: OTHER_RESOURCE_ID,
        createdBy: inviterId,
        expiresAt: hourFromNow(),
      }),
    ).rejects.toThrow();
  });

  it("rejects an unknown resource type, via the check constraint", async () => {
    await expect(
      db.execute(
        sql`insert into invites (token, resource_type, resource_id, created_by, expires_at)
            values ('tok-bad', 'ROOM', ${PLAYLIST_ID}, ${inviterId}, now())`,
      ),
    ).rejects.toThrow();
  });

  it("lists a resource's invites newest first, and only that resource's", async () => {
    await repository.create({
      token: "tok-older",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });
    await repository.create({
      token: "tok-newer",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });
    await repository.create({
      token: "tok-elsewhere",
      resourceType: "PLAYLIST",
      resourceId: OTHER_RESOURCE_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });

    const listed = await repository.listForResource({
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
    });

    expect(listed.map((invite) => invite.token)).toEqual([
      "tok-newer",
      "tok-older",
    ]);
  });

  it("lists nothing for a resource with no invites", async () => {
    expect(
      await repository.listForResource({
        resourceType: "PLAYLIST",
        resourceId: OTHER_RESOURCE_ID,
      }),
    ).toEqual([]);
  });

  it("stamps revokedAt when revoking", async () => {
    const created = await repository.create({
      token: "tok-revoke",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });
    const revokedAt = new Date();

    await repository.revoke(created.id, revokedAt);

    const found = await repository.findById(created.id);
    expect(found?.revokedAt?.getTime()).toBe(revokedAt.getTime());
  });

  it("keeps the first revocation timestamp when revoked twice", async () => {
    const created = await repository.create({
      token: "tok-revoke-twice",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });
    const first = new Date(Date.now() - 60_000);

    await repository.revoke(created.id, first);
    await repository.revoke(created.id, new Date());

    const found = await repository.findById(created.id);
    expect(found?.revokedAt?.getTime()).toBe(first.getTime());
  });

  it("revoking an unknown invite is a no-op", async () => {
    await expect(
      repository.revoke("0192f1a0-0000-7000-8000-00000000beef", new Date()),
    ).resolves.toBeUndefined();
  });

  it("deletes a user's invites along with the user", async () => {
    await repository.create({
      token: "tok-cascade",
      resourceType: "PLAYLIST",
      resourceId: PLAYLIST_ID,
      createdBy: inviterId,
      expiresAt: hourFromNow(),
    });

    await db.execute(sql`delete from users where id = ${inviterId}`);

    expect(await repository.findByToken("tok-cascade")).toBeNull();
  });
});
