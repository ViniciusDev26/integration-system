import { z } from "zod";
import { getUploadedFile } from "../../shared/http/upload.js";
import { getAuthenticatedUser } from "../auth/require-auth.js";
import type {
  MusicController,
  MusicControllerOptions,
} from "./music.controller.types.js";

/**
 * Body schema for `POST /musics` (ADR 0012). The audio file is handled by the
 * multer middleware (ADR 0032); only the text fields are validated here. Shared
 * with the route so the middleware validates and the handler reads typed values.
 */
export const createMusicSchema = {
  body: z.object({
    name: z.string().min(1),
    genre: z.string().min(1),
  }),
};

export function createMusicController(
  options: MusicControllerOptions,
): MusicController {
  const { musicService } = options;

  return {
    async create(req, res) {
      // `requireAuth` and the upload middleware guarantee both of these exist by
      // the time we get here (else they'd have 401'd / 400'd upstream).
      const user = getAuthenticatedUser(res);
      const file = getUploadedFile(req);

      const music = await musicService.register({
        name: req.body.name,
        genre: req.body.genre,
        file,
        uploadedBy: user.id,
      });

      res.status(201).json({
        id: music.id,
        name: music.name,
        genre: music.genre,
      });
    },
  };
}
