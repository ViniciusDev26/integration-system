import { type RequestHandler, Router } from "express";
import validate from "express-zod-safe";
import { createAudioUpload } from "../../shared/http/upload.js";
import { createMusicSchema } from "./music.controller.js";
import type { MusicController } from "./music.controller.types.js";

/**
 * Music routes (ADR 0018). All writes are authenticated.
 *
 * - `POST /` → upload an audio file + create a music. Middleware chain:
 *   `requireAuth` (reject anonymous before buffering any bytes) → multer
 *   (parse/validate the file, ADR 0032) → `express-zod-safe` (validate the text
 *   fields, ADR 0012) → controller.
 */
export function createMusicRoutes(
  controller: MusicController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();

  router.post(
    "/",
    requireAuth,
    createAudioUpload({ field: "file" }),
    validate(createMusicSchema),
    controller.create,
  );

  return router;
}
