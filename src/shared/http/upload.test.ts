import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { createAudioUpload, getUploadedFile } from "./upload.js";

/**
 * Mounts the upload middleware on `POST /upload` with a thin handler that echoes
 * what the boundary produced, so tests assert middleware behavior end to end.
 */
function appWith(middleware: ReturnType<typeof createAudioUpload>): Express {
  const app = express();
  app.post("/upload", middleware, (req, res) => {
    const file = getUploadedFile(req);
    res.status(201).json({
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bytes: file.buffer.toString(),
    });
  });
  return app;
}

describe("createAudioUpload", () => {
  it("accepts a valid audio file and exposes it to the handler", async () => {
    const app = appWith(createAudioUpload());

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("id3-audio-bytes"), {
        filename: "song.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      originalname: "song.mp3",
      mimetype: "audio/mpeg",
      bytes: "id3-audio-bytes",
    });
  });

  it("rejects a non-audio MIME type with 400", async () => {
    const app = appWith(createAudioUpload());

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("<html>"), {
        filename: "evil.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("rejects a file over the size limit with 413", async () => {
    const app = appWith(createAudioUpload({ maxBytes: 8 }));

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("way-too-many-bytes"), {
        filename: "big.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("responds 400 when no file is attached", async () => {
    const app = appWith(createAudioUpload());

    const res = await request(app).post("/upload").field("name", "song");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("honors a custom field name", async () => {
    const app = appWith(createAudioUpload({ field: "track" }));

    const res = await request(app)
      .post("/upload")
      .attach("track", Buffer.from("bytes"), {
        filename: "song.ogg",
        contentType: "audio/ogg",
      });

    expect(res.status).toBe(201);
    expect(res.body.mimetype).toBe("audio/ogg");
  });
});

describe("getUploadedFile", () => {
  it("throws when called without the upload middleware", () => {
    expect(() => getUploadedFile({})).toThrow();
  });
});
