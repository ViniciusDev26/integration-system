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
import { createMusicController } from "./music.controller.js";
import { createMusicRoutes } from "./music.routes.js";

interface Harness {
  app: Express;
  container: TestContainer;
}

function setup(): Harness {
  const container = createTestContainer();
  const controller = createMusicController({
    musicService: container.musicService,
  });
  // Mirror server.ts: the browser guard redirects anonymous visitors to login.
  const requireAuth = createRequireAuth({
    authService: container.authService,
    redirectTo: "/auth/github",
  });

  const app = express();
  // Mirror app.ts: templates live in ../../views relative to this module.
  app.engine("handlebars", engine({ defaultLayout: "main" }));
  app.set("view engine", "handlebars");
  app.set("views", path.join(import.meta.dirname, "..", "..", "views"));
  app.use(cookieParser());
  app.use("/musics", createMusicRoutes(controller, requireAuth));

  return { app, container };
}

/** Seeds a user + live session and returns the session cookie value. */
async function signIn(container: TestContainer): Promise<string> {
  const user = await container.userRepository.upsertByGithubId({
    githubId: "gh-1",
    name: "Ada",
    email: "ada@x.com",
    imageUrl: null,
  });
  const session = await container.sessionService.createForUser(user.id);
  return session.id;
}

describe("GET /musics/new", () => {
  it("renders the upload form for a signed-in user", async () => {
    const { app, container } = setup();
    const sessionId = await signIn(container);

    const res = await request(app)
      .get("/musics/new")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain('action="/musics"');
    expect(res.text).toContain('enctype="multipart/form-data"');
    expect(res.text).toContain('name="file"');
    expect(res.text).toContain('name="genre"');
    expect(res.text).not.toContain("Track uploaded");
  });

  it("shows a success banner when redirected back after an upload", async () => {
    const { app, container } = setup();
    const sessionId = await signIn(container);

    const res = await request(app)
      .get("/musics/new?uploaded=1")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain("Track uploaded");
  });

  it("redirects anonymous visitors to login", async () => {
    const { app } = setup();

    const res = await request(app).get("/musics/new");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/github");
  });
});

describe("POST /musics", () => {
  it("uploads the audio, stores it, creates a row, and redirects (303)", async () => {
    const { app, container } = setup();
    const sessionId = await signIn(container);

    const res = await request(app)
      .post("/musics")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`)
      .field("name", "Nocturne")
      .field("genre", "classical")
      .attach("file", Buffer.from("audio-bytes"), {
        filename: "nocturne.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(303);
    expect(res.headers.location).toBe("/musics/new?uploaded=1");

    const [row] = await container.musicRepository.list();
    expect(row?.name).toBe("Nocturne");
    expect(row?.genre).toBe("classical");
    expect(row?.objectKey).toBeTruthy();

    const stored = container.objectStorage.get(row?.objectKey ?? "");
    expect(stored?.body.toString()).toBe("audio-bytes");
    expect(stored?.contentType).toBe("audio/mpeg");
  });

  it("redirects an anonymous upload to login", async () => {
    const { app } = setup();

    const res = await request(app)
      .post("/musics")
      .field("name", "Nocturne")
      .field("genre", "classical")
      .attach("file", Buffer.from("audio-bytes"), {
        filename: "nocturne.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/github");
  });

  it("returns 400 when no file is attached", async () => {
    const { app, container } = setup();
    const sessionId = await signIn(container);

    const res = await request(app)
      .post("/musics")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`)
      .field("name", "Nocturne")
      .field("genre", "classical");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("returns 400 when a required text field is missing", async () => {
    const { app, container } = setup();
    const sessionId = await signIn(container);

    const res = await request(app)
      .post("/musics")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`)
      .field("name", "Nocturne")
      .attach("file", Buffer.from("audio-bytes"), {
        filename: "nocturne.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-audio file", async () => {
    const { app, container } = setup();
    const sessionId = await signIn(container);

    const res = await request(app)
      .post("/musics")
      .set("Cookie", `${SESSION_COOKIE}=${sessionId}`)
      .field("name", "Nocturne")
      .field("genre", "classical")
      .attach("file", Buffer.from("<html>"), {
        filename: "evil.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_upload");
  });
});
