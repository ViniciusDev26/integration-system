import { describe, expect, it } from "vitest";
import { createTestContainer, type TestContainer } from "../container-test.js";
import { OAUTH_STATE_COOKIE } from "../modules/auth/http/auth.controller.constants.js";
import type { User } from "../shared/db/schema/users.js";
import type { Context } from "./context.js";
import { createAppRouter } from "./router.js";

function appRouterFor(container: TestContainer) {
  return createAppRouter({
    authService: container.authService,
    sessionService: container.sessionService,
    musicService: container.musicService,
    playlistService: container.playlistService,
    inviteService: container.inviteService,
    roomService: container.roomService,
    secureCookies: false,
  });
}

function callerFor(
  container: TestContainer,
  user: User | null,
  cookies: Record<string, string> = {},
) {
  const ctx: Context = {
    req: { cookies },
    res: { cookie: () => undefined, clearCookie: () => undefined },
    user,
  };
  return appRouterFor(container).createCaller(ctx);
}

function seedUser(container: TestContainer, githubId = "gh-1"): Promise<User> {
  return container.userRepository.upsertByGithubId({
    githubId,
    name: githubId,
    email: `${githubId}@x.com`,
    imageUrl: null,
  });
}

describe("trpc auth.startLogin", () => {
  it("returns the GitHub URL and sets the state cookie", async () => {
    const container = createTestContainer({
      github: { authorizationUrl: "https://github.test/authorize" },
    });
    const cookiesSet: string[] = [];
    const ctx: Context = {
      req: { cookies: {} },
      res: {
        cookie: (name) => {
          cookiesSet.push(name);
        },
        clearCookie: () => undefined,
      },
      user: null,
    };

    const { url } = await appRouterFor(container)
      .createCaller(ctx)
      .auth.startLogin();

    expect(url).toContain("github.test/authorize");
    expect(cookiesSet).toContain(OAUTH_STATE_COOKIE);
  });
});

describe("trpc auth", () => {
  it("me returns the current user; UNAUTHORIZED when anonymous", async () => {
    const container = createTestContainer();
    const user = await seedUser(container);

    const me = await callerFor(container, user).auth.me();
    expect(me).toMatchObject({ id: user.id, email: "gh-1@x.com" });

    await expect(callerFor(container, null).auth.me()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("logout revokes the session cookie", async () => {
    const container = createTestContainer();
    const user = await seedUser(container);
    const session = await container.sessionService.createForUser(user.id);

    await callerFor(container, user, { session: session.id }).auth.logout();

    expect(await container.sessionService.validate(session.id)).toBeNull();
  });
});

describe("trpc musics", () => {
  it("prepareUpload → create → list round-trips", async () => {
    const container = createTestContainer();
    const user = await seedUser(container);
    const caller = callerFor(container, user);

    const prepared = await caller.musics.prepareUpload({
      audio: { filename: "song.mp3", contentType: "audio/mpeg" },
    });
    expect(prepared.audio.uploadUrl).toContain(prepared.audio.objectKey);

    const created = await caller.musics.create({
      name: "Nocturne",
      genres: ["classical", "piano"],
      objectKey: prepared.audio.objectKey,
      thumbnailObjectKey: null,
    });
    expect(created).toMatchObject({ name: "Nocturne" });

    const list = await caller.musics.list();
    expect(list.map((m) => m.name)).toEqual(["Nocturne"]);
    expect(list[0]?.genres).toEqual(["classical", "piano"]);
  });

  it("list is UNAUTHORIZED when anonymous", async () => {
    const container = createTestContainer();
    await expect(
      callerFor(container, null).musics.list(),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("trpc playlists", () => {
  it("create/list/get/addMusic for the owner", async () => {
    const container = createTestContainer();
    const user = await seedUser(container);
    const caller = callerFor(container, user);
    const music = await container.musicRepository.create({
      name: "A",
      genres: ["pop"],
      objectKey: "musics/a.mp3",
      thumbnailObjectKey: null,
      uploadedBy: user.id,
    });

    const playlist = await caller.playlists.create({ name: "Mix" });
    expect((await caller.playlists.list()).map((p) => p.name)).toEqual(["Mix"]);

    await caller.playlists.addMusic({
      playlistId: playlist.id,
      musicId: music.id,
    });

    const detail = await caller.playlists.get({ id: playlist.id });
    expect(detail.playlist.name).toBe("Mix");
    expect(detail.musics.map((m) => m.name)).toEqual(["A"]);
  });

  it("maps membership errors: FORBIDDEN for non-members, NOT_FOUND for unknown", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const intruder = await seedUser(container, "intruder");
    const playlist = await callerFor(container, owner).playlists.create({
      name: "Private",
    });

    await expect(
      callerFor(container, intruder).playlists.get({ id: playlist.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      callerFor(container, owner).playlists.get({ id: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("trpc invites", () => {
  async function playlistOwnedBy(container: TestContainer, user: User) {
    return container.playlistService.createForUser({
      name: "Shared",
      ownerId: user.id,
    });
  }

  it("issues a link the owner can share", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const playlist = await playlistOwnedBy(container, owner);

    const invite = await callerFor(container, owner).invites.create({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });

    expect(invite.token).toEqual(expect.any(String));
    expect(invite.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses to issue a link for someone else's playlist", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const stranger = await seedUser(container, "stranger");
    const playlist = await playlistOwnedBy(container, owner);

    await expect(
      callerFor(container, stranger).invites.create({
        resourceType: "PLAYLIST",
        resourceId: playlist.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a guest redeem the link and then see the playlist", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const guest = await seedUser(container, "guest");
    const playlist = await playlistOwnedBy(container, owner);
    const { token } = await callerFor(container, owner).invites.create({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });

    const guestCaller = callerFor(container, guest);
    expect(await guestCaller.playlists.list()).toEqual([]);

    const redeemed = await guestCaller.invites.redeem({ token });

    expect(redeemed).toEqual({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });
    expect((await guestCaller.playlists.list()).map((p) => p.id)).toEqual([
      playlist.id,
    ]);
  });

  it("lets the redeemed guest add a track, as a member", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const guest = await seedUser(container, "guest");
    const playlist = await playlistOwnedBy(container, owner);
    const { token } = await callerFor(container, owner).invites.create({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });
    const music = await container.musicRepository.create({
      name: "Track",
      genres: ["rock"],
      objectKey: "musics/x.mp3",
      thumbnailObjectKey: null,
      uploadedBy: owner.id,
    });

    const guestCaller = callerFor(container, guest);
    await guestCaller.invites.redeem({ token });

    await expect(
      guestCaller.playlists.addMusic({
        playlistId: playlist.id,
        musicId: music.id,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("rejects an unknown token", async () => {
    const container = createTestContainer();
    const guest = await seedUser(container, "guest");

    await expect(
      callerFor(container, guest).invites.redeem({ token: "nope" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a revoked token, and says why", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const guest = await seedUser(container, "guest");
    const playlist = await playlistOwnedBy(container, owner);
    const ownerCaller = callerFor(container, owner);
    const { token } = await ownerCaller.invites.create({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });
    const [listed] = await ownerCaller.invites.list({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });

    await ownerCaller.invites.revoke({ inviteId: listed?.id ?? "" });

    await expect(
      callerFor(container, guest).invites.redeem({ token }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "invite_revoked" });
  });

  it("refuses to list invites to a non-owner", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const stranger = await seedUser(container, "stranger");
    const playlist = await playlistOwnedBy(container, owner);

    await expect(
      callerFor(container, stranger).invites.list({
        resourceType: "PLAYLIST",
        resourceId: playlist.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("requires authentication", async () => {
    const container = createTestContainer();

    await expect(
      callerFor(container, null).invites.redeem({ token: "whatever" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("trpc playlists.onChanged", () => {
  async function sharedPlaylist(container: TestContainer) {
    const owner = await seedUser(container, "owner");
    const guest = await seedUser(container, "guest");
    const playlist = await container.playlistService.createForUser({
      name: "Shared",
      ownerId: owner.id,
    });
    const { token } = await callerFor(container, owner).invites.create({
      resourceType: "PLAYLIST",
      resourceId: playlist.id,
    });
    return { owner, guest, playlist, token };
  }

  it("delivers another member's track addition to a watcher", async () => {
    const container = createTestContainer();
    const { owner, guest, playlist, token } = await sharedPlaylist(container);
    const guestCaller = callerFor(container, guest);
    await guestCaller.invites.redeem({ token });

    const stream = await guestCaller.playlists.onChanged({
      playlistId: playlist.id,
    });
    const firstEvent = (async () => {
      for await (const event of stream) {
        return event;
      }
      return null;
    })();

    const music = await container.musicRepository.create({
      name: "Track",
      genres: ["rock"],
      objectKey: "musics/x.mp3",
      thumbnailObjectKey: null,
      uploadedBy: owner.id,
    });
    await callerFor(container, owner).playlists.addMusic({
      playlistId: playlist.id,
      musicId: music.id,
    });

    expect(await firstEvent).toEqual({
      type: "MUSIC_ADDED",
      playlistId: playlist.id,
      musicId: music.id,
      actorId: owner.id,
    });
  });

  it("tells watchers when someone joins through a link", async () => {
    const container = createTestContainer();
    const { owner, guest, playlist, token } = await sharedPlaylist(container);

    const stream = await callerFor(container, owner).playlists.onChanged({
      playlistId: playlist.id,
    });
    const firstEvent = (async () => {
      for await (const event of stream) {
        return event;
      }
      return null;
    })();

    await callerFor(container, guest).invites.redeem({ token });

    expect(await firstEvent).toEqual({
      type: "MEMBER_JOINED",
      playlistId: playlist.id,
      actorId: guest.id,
    });
  });

  it("refuses to stream to a non-member", async () => {
    const container = createTestContainer();
    const { playlist } = await sharedPlaylist(container);
    const stranger = await seedUser(container, "stranger");

    // A subscription resolver does not run until the stream is first pulled,
    // so the rejection surfaces on iteration rather than on the call.
    const stream = await callerFor(container, stranger).playlists.onChanged({
      playlistId: playlist.id,
    });

    await expect(
      (async () => {
        for await (const event of stream) {
          return event;
        }
        return null;
      })(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lists members to a member, and refuses an outsider", async () => {
    const container = createTestContainer();
    const { owner, guest, playlist, token } = await sharedPlaylist(container);
    const stranger = await seedUser(container, "stranger");
    await callerFor(container, guest).invites.redeem({ token });

    const members = await callerFor(container, guest).playlists.members({
      playlistId: playlist.id,
    });

    expect(members.map((m) => [m.userId, m.type])).toEqual([
      [owner.id, "OWNER"],
      [guest.id, "MEMBER"],
    ]);
    await expect(
      callerFor(container, stranger).playlists.members({
        playlistId: playlist.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("trpc rooms", () => {
  async function roomWithTrack(container: TestContainer) {
    const owner = await seedUser(container, "owner");
    const room = await container.roomService.createForUser({
      name: "Friday",
      ownerId: owner.id,
    });
    const music = await container.musicRepository.create({
      name: "Track",
      genres: ["rock"],
      objectKey: "musics/x.mp3",
      thumbnailObjectKey: null,
      uploadedBy: owner.id,
    });
    await callerFor(container, owner).rooms.queueMusic({
      roomId: room.id,
      musicId: music.id,
    });
    return { owner, room, music };
  }

  it("creates a room the owner can see, and nobody else", async () => {
    const container = createTestContainer();
    const owner = await seedUser(container, "owner");
    const stranger = await seedUser(container, "stranger");

    const room = await callerFor(container, owner).rooms.create({
      name: "Friday",
    });

    expect(
      (await callerFor(container, owner).rooms.list()).map((r) => r.id),
    ).toEqual([room.id]);
    expect(await callerFor(container, stranger).rooms.list()).toEqual([]);
    await expect(
      callerFor(container, stranger).rooms.get({ roomId: room.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("lets a guest join a room through an invite link", async () => {
    const container = createTestContainer();
    const { owner, room } = await roomWithTrack(container);
    const guest = await seedUser(container, "guest");

    const { token } = await callerFor(container, owner).invites.create({
      resourceType: "ROOM",
      resourceId: room.id,
    });
    const redeemed = await callerFor(container, guest).invites.redeem({
      token,
    });

    expect(redeemed).toEqual({ resourceType: "ROOM", resourceId: room.id });
    expect(
      (await callerFor(container, guest).rooms.list()).map((r) => r.id),
    ).toEqual([room.id]);
  });

  it("refuses to issue a room invite to a non-owner", async () => {
    const container = createTestContainer();
    const { room } = await roomWithTrack(container);
    const stranger = await seedUser(container, "stranger");

    await expect(
      callerFor(container, stranger).invites.create({
        resourceType: "ROOM",
        resourceId: room.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("anchors playback and reports it in the snapshot", async () => {
    const container = createTestContainer();
    const { owner, room, music } = await roomWithTrack(container);
    const caller = callerFor(container, owner);

    await caller.rooms.commandPlayback({
      roomId: room.id,
      command: { type: "SELECT_TRACK", musicId: music.id },
    });

    const snapshot = await caller.rooms.get({ roomId: room.id });
    expect(snapshot.room.currentMusicId).toBe(music.id);
    expect(snapshot.room.isPlaying).toBe(true);
    expect(snapshot.serverNow).toBeInstanceOf(Date);
  });

  it("refuses to play a track that is not queued in the room", async () => {
    const container = createTestContainer();
    const { owner, room } = await roomWithTrack(container);
    const elsewhere = await container.musicRepository.create({
      name: "Elsewhere",
      genres: [],
      objectKey: "musics/y.mp3",
      thumbnailObjectKey: null,
      uploadedBy: owner.id,
    });

    await expect(
      callerFor(container, owner).rooms.commandPlayback({
        roomId: room.id,
        command: { type: "SELECT_TRACK", musicId: elsewhere.id },
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("delivers a playback command to a listener, with the server's clock", async () => {
    const container = createTestContainer();
    const { owner, room, music } = await roomWithTrack(container);
    const caller = callerFor(container, owner);

    const stream = await caller.rooms.onChanged({ roomId: room.id });
    const events: unknown[] = [];
    const collecting = (async () => {
      for await (const event of stream) {
        events.push(event);
        if (events.length === 2) {
          break;
        }
      }
    })();

    await caller.rooms.commandPlayback({
      roomId: room.id,
      command: { type: "SELECT_TRACK", musicId: music.id },
    });
    await collecting;

    // Opening the stream marks you present; then the command arrives.
    expect(events[0]).toMatchObject({
      type: "PRESENCE_CHANGED",
      present: [owner.id],
    });
    expect(events[1]).toMatchObject({
      type: "PLAYBACK_CHANGED",
      actorId: owner.id,
    });
  });

  it("refuses to stream to a non-member", async () => {
    const container = createTestContainer();
    const { room } = await roomWithTrack(container);
    const stranger = await seedUser(container, "stranger");

    const stream = await callerFor(container, stranger).rooms.onChanged({
      roomId: room.id,
    });

    await expect(
      (async () => {
        for await (const event of stream) {
          return event;
        }
        return null;
      })(),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("trpc auth — email/password", () => {
  /** A caller that records the cookies the procedures set. */
  function callerRecordingCookies(container: TestContainer) {
    const cookies: Array<{ name: string; value: string }> = [];
    const ctx: Context = {
      req: { cookies: {} },
      res: {
        cookie: (name, value) => {
          cookies.push({ name, value });
        },
        clearCookie: () => undefined,
      },
      user: null,
    };
    return { caller: appRouterFor(container).createCaller(ctx), cookies };
  }

  it("registers, sets the session cookie, and signs the user in", async () => {
    const container = createTestContainer();
    const { caller, cookies } = callerRecordingCookies(container);

    await caller.auth.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    expect(cookies.map((c) => c.name)).toEqual(["session"]);
    const user =
      await container.userRepository.findByEmail("grace@example.com");
    expect(user?.name).toBe("Grace");
  });

  it("normalizes the email, so case and padding do not create a second account", async () => {
    const container = createTestContainer();

    await callerRecordingCookies(container).caller.auth.register({
      email: "  Grace@Example.COM ",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    expect(
      await container.userRepository.findByEmail("grace@example.com"),
    ).not.toBeNull();
    // And the same address in another casing logs in rather than registering.
    await expect(
      callerRecordingCookies(container).caller.auth.login({
        email: "GRACE@example.com",
        password: "hunter2-hunter2",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("refuses a second registration on the same address", async () => {
    const container = createTestContainer();
    await callerRecordingCookies(container).caller.auth.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    await expect(
      callerRecordingCookies(container).caller.auth.register({
        email: "grace@example.com",
        password: "another-password",
        name: "Impostor",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT", message: "email_in_use" });
  });

  it("rejects a wrong password and an unknown address identically", async () => {
    const container = createTestContainer();
    await callerRecordingCookies(container).caller.auth.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    const wrong = callerRecordingCookies(container).caller.auth.login({
      email: "grace@example.com",
      password: "wrong-password",
    });
    const unknown = callerRecordingCookies(container).caller.auth.login({
      email: "nobody@example.com",
      password: "hunter2-hunter2",
    });

    await expect(wrong).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "invalid_credentials",
    });
    await expect(unknown).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "invalid_credentials",
    });
  });

  it("rejects a password shorter than the minimum", async () => {
    const container = createTestContainer();

    await expect(
      callerRecordingCookies(container).caller.auth.register({
        email: "grace@example.com",
        password: "short",
        name: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects an address that is not an address", async () => {
    const container = createTestContainer();

    await expect(
      callerRecordingCookies(container).caller.auth.register({
        email: "not-an-email",
        password: "hunter2-hunter2",
        name: null,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
