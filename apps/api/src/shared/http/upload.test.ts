import express, { type Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  createUpload,
  getOptionalFile,
  getUploadedFile,
  type UploadFieldSpec,
} from "./upload.js";

const AUDIO = ["audio/mpeg"];
const IMAGE = ["image/png"];

/**
 * Mounts the upload middleware on `POST /upload` with a thin handler that echoes
 * what the boundary produced, so tests assert middleware behavior end to end.
 */
function appWith(fields: UploadFieldSpec[]): Express {
  const app = express();
  app.post("/upload", createUpload(fields), (req, res) => {
    const file = getUploadedFile(req, "file");
    const thumb = getOptionalFile(req, "thumbnail");
    res.status(201).json({
      file: { name: file.originalname, bytes: file.buffer.toString() },
      thumbnail: thumb === undefined ? null : { name: thumb.originalname },
    });
  });
  return app;
}

const audioField: UploadFieldSpec = {
  name: "file",
  allowedMimeTypes: AUDIO,
  required: true,
};
const thumbField: UploadFieldSpec = {
  name: "thumbnail",
  allowedMimeTypes: IMAGE,
};

describe("createUpload", () => {
  it("accepts a required file and exposes it to the handler", async () => {
    const app = appWith([audioField, thumbField]);

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("id3-audio"), {
        filename: "song.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(201);
    expect(res.body.file).toEqual({ name: "song.mp3", bytes: "id3-audio" });
    expect(res.body.thumbnail).toBeNull();
  });

  it("accepts an optional second file alongside the required one", async () => {
    const app = appWith([audioField, thumbField]);

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("id3-audio"), {
        filename: "song.mp3",
        contentType: "audio/mpeg",
      })
      .attach("thumbnail", Buffer.from("png-bytes"), {
        filename: "cover.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(201);
    expect(res.body.thumbnail).toEqual({ name: "cover.png" });
  });

  it("rejects a wrong MIME type for a field with 400", async () => {
    const app = appWith([audioField, thumbField]);

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("id3-audio"), {
        filename: "song.mp3",
        contentType: "audio/mpeg",
      })
      .attach("thumbnail", Buffer.from("<html>"), {
        filename: "evil.html",
        contentType: "text/html",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("rejects a file over its field size limit with 413", async () => {
    const app = appWith([
      { name: "file", allowedMimeTypes: AUDIO, required: true, maxBytes: 8 },
    ]);

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("way-too-many-bytes"), {
        filename: "big.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("responds 400 when a required field is missing", async () => {
    const app = appWith([audioField, thumbField]);

    const res = await request(app).post("/upload").field("name", "song");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_upload");
  });

  it("rejects an unexpected file field with 400", async () => {
    const app = appWith([audioField]);

    const res = await request(app)
      .post("/upload")
      .attach("file", Buffer.from("id3-audio"), {
        filename: "song.mp3",
        contentType: "audio/mpeg",
      })
      .attach("surprise", Buffer.from("x"), {
        filename: "x.mp3",
        contentType: "audio/mpeg",
      });

    expect(res.status).toBe(400);
  });
});

describe("getUploadedFile", () => {
  it("throws when the field is absent", () => {
    expect(() => getUploadedFile({}, "file")).toThrow();
  });
});

describe("getOptionalFile", () => {
  it("returns undefined when the field is absent", () => {
    expect(getOptionalFile({}, "thumbnail")).toBeUndefined();
  });
});
