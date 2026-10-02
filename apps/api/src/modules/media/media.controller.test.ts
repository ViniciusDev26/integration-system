import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import cookieParser from "cookie-parser";
import express, { type Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestContainer } from "../../container-test.js";
import { SESSION_COOKIE } from "../auth/http/auth.controller.constants.js";
import { MEDIA_ENDPOINT } from "./media.constants.js";
import { createMediaController } from "./media.controller.js";
import { createMediaRoutes } from "./media.routes.js";

const AUDIO = "0123456789abcdefghij";

/**
 * Stands in for R2: serves one object and honours `Range`, so the redirect can
 * be followed end to end. R2's own range support comes from the S3 API; what
 * this proves is that **our** redirect does not get in its way (ADR 0045).
 */
function startObjectServer(): Promise<{ origin: string; close: () => void }> {
  return new Promise((resolve) => {
    const server: Server = createServer((req, res) => {
      const range = req.headers.range;
      if (range === undefined) {
        res.writeHead(200, { "content-length": String(AUDIO.length) });
        res.end(AUDIO);
        return;
      }
      const match = /bytes=(\d+)-(\d*)/.exec(range);
      const start = Number(match?.[1] ?? 0);
      const end = match?.[2] ? Number(match[2]) : AUDIO.length - 1;
      const slice = AUDIO.slice(start, end + 1);
      res.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${AUDIO.length}`,
        "content-length": String(slice.length),
      });
      res.end(slice);
    });
    server.listen(0, () => {
      const address = server.address();
      const port =
        typeof address === "object" && address !== null
          ? (address as AddressInfo).port
          : 0;
      resolve({
        origin: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

describe("media redirect (ADR 0045)", () => {
  let objectServer: Awaited<ReturnType<typeof startObjectServer>>;

  beforeAll(async () => {
    objectServer = await startObjectServer();
  });

  afterAll(() => {
    objectServer.close();
  });

  async function setup() {
    const container = createTestContainer();
    const controller = createMediaController({
      authService: container.authService,
      musicRepository: container.musicRepository,
      objectStorage: {
        // Point every signed URL at the local object server, with the key in
        // the path so the test can tell audio from cover.
        getSignedUrl: async (key) =>
          `${objectServer.origin}/${key}?signature=fresh`,
      },
    });

    const app: Express = express();
    app.use(cookieParser());
    app.use(MEDIA_ENDPOINT, createMediaRoutes(controller));

    const user = await container.userRepository.upsertByGithubId({
      githubId: "listener",
      name: "Listener",
      email: "listener@example.com",
      imageUrl: null,
    });
    const session = await container.sessionService.createForUser(user.id);
    const music = await container.musicRepository.create({
      name: "Track",
      genres: ["rock"],
      objectKey: "musics/track.mp3",
      thumbnailObjectKey: "musics/thumbnails/track.png",
      uploadedBy: user.id,
    });
    const coverless = await container.musicRepository.create({
      name: "No cover",
      genres: [],
      objectKey: "musics/bare.mp3",
      thumbnailObjectKey: null,
      uploadedBy: user.id,
    });

    return {
      app,
      cookie: `${SESSION_COOKIE}=${session.id}`,
      musicId: music.id,
      coverlessId: coverless.id,
    };
  }

  it("redirects a signed-in listener to a fresh signed URL", async () => {
    const { app, cookie, musicId } = await setup();

    const response = await request(app)
      .get(`/media/musics/${musicId}`)
      .set("Cookie", cookie)
      .expect(302);

    expect(response.headers.location).toContain("musics/track.mp3");
    expect(response.headers.location).toContain("signature=fresh");
  });

  it("never caches the redirect, so expiry cannot come back", async () => {
    const { app, cookie, musicId } = await setup();

    const response = await request(app)
      .get(`/media/musics/${musicId}`)
      .set("Cookie", cookie)
      .expect(302);

    expect(response.headers["cache-control"]).toBe("no-store");
  });

  it("refuses an anonymous request", async () => {
    const { app, musicId } = await setup();

    await request(app).get(`/media/musics/${musicId}`).expect(401);
  });

  it("refuses an unknown session", async () => {
    const { app, musicId } = await setup();

    await request(app)
      .get(`/media/musics/${musicId}`)
      .set("Cookie", `${SESSION_COOKIE}=not-a-session`)
      .expect(401);
  });

  it("404s an id that matches no track", async () => {
    const { app, cookie } = await setup();

    // The lookup is the authority — a malformed id is simply not found.
    await request(app)
      .get("/media/musics/0192f1a0-0000-7000-8000-00000000dead")
      .set("Cookie", cookie)
      .expect(404);
    await request(app)
      .get("/media/musics/not-an-id-at-all")
      .set("Cookie", cookie)
      .expect(404);
  });

  it("redirects to the cover, and 404s a track without one", async () => {
    const { app, cookie, musicId, coverlessId } = await setup();

    const cover = await request(app)
      .get(`/media/musics/${musicId}/cover`)
      .set("Cookie", cookie)
      .expect(302);
    expect(cover.headers.location).toContain("thumbnails/track.png");

    await request(app)
      .get(`/media/musics/${coverlessId}/cover`)
      .set("Cookie", cookie)
      .expect(404);
  });

  it("issues a different URL each time, rather than one that ages", async () => {
    let issued = 0;
    const container = createTestContainer();
    const controller = createMediaController({
      authService: container.authService,
      musicRepository: {
        findById: async () => ({
          id: "music-counted",
          name: "Track",
          genres: [],
          objectKey: "musics/track.mp3",
          thumbnailObjectKey: null,
          uploadedBy: "someone",
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
      objectStorage: {
        getSignedUrl: async (key) => {
          issued += 1;
          return `${objectServer.origin}/${key}?issue=${issued}`;
        },
      },
    });
    const freshApp: Express = express();
    freshApp.use(cookieParser());
    freshApp.use(MEDIA_ENDPOINT, createMediaRoutes(controller));
    const user = await container.userRepository.upsertByGithubId({
      githubId: "listener",
      name: "Listener",
      email: "listener@example.com",
      imageUrl: null,
    });
    const session = await container.sessionService.createForUser(user.id);
    const ownCookie = `${SESSION_COOKIE}=${session.id}`;

    const first = await request(freshApp)
      .get("/media/musics/music-counted")
      .set("Cookie", ownCookie);
    const second = await request(freshApp)
      .get("/media/musics/music-counted")
      .set("Cookie", ownCookie);

    // Two requests for the same track get two signatures — the URL is minted
    // per request rather than aging in the client's hands (ADR 0045).
    expect(first.headers.location).not.toBe(second.headers.location);
    expect(issued).toBe(2);
  });

  it("follows through to the object, including a Range request", async () => {
    const { app, cookie, musicId } = await setup();

    const redirect = await request(app)
      .get(`/media/musics/${musicId}`)
      .set("Cookie", cookie)
      .expect(302);
    const target = redirect.headers.location;
    if (typeof target !== "string") {
      throw new Error("expected a Location header on the redirect");
    }

    // What a seeking <audio> does: follow the redirect, then ask for a slice.
    const ranged = await fetch(target, { headers: { range: "bytes=5-9" } });

    expect(ranged.status).toBe(206);
    expect(await ranged.text()).toBe("56789");
    expect(ranged.headers.get("content-range")).toBe("bytes 5-9/20");
  });
});
