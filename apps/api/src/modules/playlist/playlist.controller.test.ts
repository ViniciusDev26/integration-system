import path from "node:path";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import { engine } from "express-handlebars";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createTestContainer,
  type TestContainer,
} from "../../container-test.js";
import { SESSION_COOKIE } from "../auth/auth.controller.constants.js";
import { createRequireAuth } from "../auth/require-auth.js";
import { createPlaylistController } from "./playlist.controller.js";
import { createPlaylistRoutes } from "./playlist.routes.js";

interface Harness {
  app: Express;
  container: TestContainer;
}

function setup(): Harness {
  const container = createTestContainer();
  const controller = createPlaylistController({
    playlistService: container.playlistService,
    musicService: container.musicService,
  });
  const requireAuth = createRequireAuth({
    authService: container.authService,
    redirectTo: "/auth/github",
  });

  const app = express();
  app.engine("handlebars", engine({ defaultLayout: "main" }));
  app.set("view engine", "handlebars");
  app.set("views", path.join(import.meta.dirname, "..", "..", "views"));
  app.use(cookieParser());
  // Mirror app.ts: parse both urlencoded (browser forms) and JSON bodies.
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use("/playlists", createPlaylistRoutes(controller, requireAuth));

  return { app, container };
}

/** Seeds a user (by github id) + a live session; returns { userId, cookie }. */
async function signIn(
  container: TestContainer,
  githubId = "gh-1",
): Promise<{ userId: string; cookie: string }> {
  const user = await container.userRepository.upsertByGithubId({
    githubId,
    name: githubId,
    email: `${githubId}@x.com`,
    imageUrl: null,
  });
  const session = await container.sessionService.createForUser(user.id);
  return { userId: user.id, cookie: `${SESSION_COOKIE}=${session.id}` };
}

describe("GET /playlists", () => {
  it("lists the current user's playlists", async () => {
    const { app, container } = setup();
    const { userId, cookie } = await signIn(container);
    await container.playlistService.createForUser({
      name: "Road trip",
      ownerId: userId,
    });

    const res = await request(app).get("/playlists").set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Road trip");
  });

  it("redirects anonymous visitors to login", async () => {
    const { app } = setup();
    const res = await request(app).get("/playlists");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/github");
  });
});

describe("POST /playlists", () => {
  it("creates a playlist and redirects to it", async () => {
    const { app, container } = setup();
    const { cookie } = await signIn(container);

    const res = await request(app)
      .post("/playlists")
      .set("Cookie", cookie)
      .send({ name: "Chill" });

    expect(res.status).toBe(303);
    expect(res.headers.location).toMatch(/^\/playlists\/.+/);
  });

  it("returns 400 when name is missing", async () => {
    const { app, container } = setup();
    const { cookie } = await signIn(container);

    const res = await request(app)
      .post("/playlists")
      .set("Cookie", cookie)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("GET /playlists/:id", () => {
  it("renders the playlist with its tracks and an add-track picker", async () => {
    const { app, container } = setup();
    const { userId, cookie } = await signIn(container);
    const playlist = await container.playlistService.createForUser({
      name: "Mix",
      ownerId: userId,
    });
    const music = await container.musicRepository.create({
      name: "Nocturne",
      genres: ["classical"],
      objectKey: "musics/nocturne.mp3",
      thumbnailObjectKey: null,
      uploadedBy: userId,
    });
    await container.playlistService.addMusic({
      playlistId: playlist.id,
      musicId: music.id,
      requesterId: userId,
    });

    const res = await request(app)
      .get(`/playlists/${playlist.id}`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Mix");
    expect(res.text).toContain("Nocturne");
    expect(res.text).toContain("musics/nocturne.mp3");
    expect(res.text).toContain('name="musicId"');
  });

  it("returns 403 for a non-member", async () => {
    const { app, container } = setup();
    const owner = await signIn(container, "owner");
    const intruder = await signIn(container, "intruder");
    const playlist = await container.playlistService.createForUser({
      name: "Private",
      ownerId: owner.userId,
    });

    const res = await request(app)
      .get(`/playlists/${playlist.id}`)
      .set("Cookie", intruder.cookie);

    expect(res.status).toBe(403);
  });

  it("returns 404 for an unknown playlist", async () => {
    const { app, container } = setup();
    const { cookie } = await signIn(container);

    const res = await request(app).get("/playlists/nope").set("Cookie", cookie);

    expect(res.status).toBe(404);
  });
});

describe("POST /playlists/:id/musics", () => {
  it("adds a track and redirects back to the playlist", async () => {
    const { app, container } = setup();
    const { userId, cookie } = await signIn(container);
    const playlist = await container.playlistService.createForUser({
      name: "Mix",
      ownerId: userId,
    });
    const music = await container.musicRepository.create({
      name: "A",
      genres: ["pop"],
      objectKey: "musics/a.mp3",
      thumbnailObjectKey: null,
      uploadedBy: userId,
    });

    const res = await request(app)
      .post(`/playlists/${playlist.id}/musics`)
      .set("Cookie", cookie)
      .send({ musicId: music.id });

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe(`/playlists/${playlist.id}`);

    const tracks = await container.playlistRepository.listMusics(playlist.id);
    expect(tracks.map((m) => m.name)).toEqual(["A"]);
  });

  it("returns 403 when a non-member tries to add a track", async () => {
    const { app, container } = setup();
    const owner = await signIn(container, "owner");
    const intruder = await signIn(container, "intruder");
    const playlist = await container.playlistService.createForUser({
      name: "Private",
      ownerId: owner.userId,
    });
    const music = await container.musicRepository.create({
      name: "A",
      genres: ["pop"],
      objectKey: "musics/a.mp3",
      thumbnailObjectKey: null,
      uploadedBy: owner.userId,
    });

    const res = await request(app)
      .post(`/playlists/${playlist.id}/musics`)
      .set("Cookie", intruder.cookie)
      .send({ musicId: music.id });

    expect(res.status).toBe(403);
  });
});
