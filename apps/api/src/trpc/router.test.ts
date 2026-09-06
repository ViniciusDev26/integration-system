import { describe, expect, it } from "vitest";
import { createTestContainer, type TestContainer } from "../container-test.js";
import { OAUTH_STATE_COOKIE } from "../modules/auth/auth.controller.constants.js";
import type { User } from "../shared/db/schema/users.js";
import type { Context } from "./context.js";
import { createAppRouter } from "./router.js";

function appRouterFor(container: TestContainer) {
  return createAppRouter({
    authService: container.authService,
    sessionService: container.sessionService,
    musicService: container.musicService,
    playlistService: container.playlistService,
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
