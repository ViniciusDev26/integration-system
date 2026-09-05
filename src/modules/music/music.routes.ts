import { type RequestHandler, Router } from "express";
import validate from "express-zod-safe";
import { createAudioUpload } from "../../shared/http/upload.js";
import { createMusicSchema } from "./music.controller.js";
import type { MusicController } from "./music.controller.types.js";

/**
 * Music routes (ADR 0018). All routes are authenticated; `requireAuth` redirects
 * anonymous browsers to login (ADR 0030).
 *
 * - `GET  /`    → list ALL musics (not user-scoped) with playback URLs.
 * - `GET  /new` → render the upload form page.
 * - `POST /`    → upload an audio file + create a music. Middleware chain:
 *   `requireAuth` (reject anonymous before buffering any bytes) → multer
 *   (parse/validate the file, ADR 0032) → `express-zod-safe` (validate the text
 *   fields, ADR 0012) → controller.
 */
export function createMusicRoutes(
  controller: MusicController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();

  router.get("/", requireAuth, controller.showList);
  router.get("/new", requireAuth, controller.showUploadForm);

  router.post(
    "/",
    requireAuth,
    createAudioUpload({ field: "file" }),
    validate(createMusicSchema),
    controller.create,
  );

  return router;
}
