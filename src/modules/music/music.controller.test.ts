import cookieParser from "cookie-parser";
import express, { type Express } from "express";
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
  const requireAuth = createRequireAuth({ authService: container.authService });

  const app = express();
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

describe("POST /musics", () => {
  it("uploads the audio, stores it, and creates a row (201)", async () => {
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

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: "Nocturne", genre: "classical" });
    expect(res.body.id).toBeTruthy();

    const [row] = await container.musicRepository.list();
    expect(row?.name).toBe("Nocturne");
    expect(row?.objectKey).toBeTruthy();

    const stored = container.objectStorage.get(row?.objectKey ?? "");
    expect(stored?.body.toString()).toBe("audio-bytes");
    expect(stored?.contentType).toBe("audio/mpeg");
  });

  it("rejects an anonymous upload with 401", async () => {
    const { app } = setup();

    const res = await request(app)
      .post("/musics")
      .field("name", "Nocturne")
      .field("genre", "classical")
      .attach("file", Buffer.from("audio-bytes"), {
        filename: "nocturne.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(401);
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
