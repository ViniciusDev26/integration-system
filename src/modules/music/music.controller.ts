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
    showUploadForm(req, res) {
      res.render("music-upload", {
        title: "Upload — Spotifake",
        uploaded: req.query.uploaded === "1",
      });
    },

    async create(req, res) {
      // `requireAuth` and the upload middleware guarantee both of these exist by
      // the time we get here (else they'd have redirected / 400'd upstream).
      const user = getAuthenticatedUser(res);
      const file = getUploadedFile(req);

      await musicService.register({
        name: req.body.name,
        genre: req.body.genre,
        file,
        uploadedBy: user.id,
      });

      // Server-rendered flow (ADR 0030): redirect back to the form with a
      // success flag rather than returning JSON. 303 so the browser follows
      // this POST with a GET.
      res.redirect(303, "/musics/new?uploaded=1");
    },
  };
}
