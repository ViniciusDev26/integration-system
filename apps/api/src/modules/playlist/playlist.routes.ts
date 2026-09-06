import { type RequestHandler, Router } from "express";
import validate from "express-zod-safe";
import {
  addMusicSchema,
  createPlaylistSchema,
  showPlaylistSchema,
} from "./playlist.controller.js";
import type { PlaylistController } from "./playlist.controller.types.js";

/**
 * Playlist routes (ADR 0018). All are authenticated; `requireAuth` redirects
 * anonymous browsers to login (ADR 0030). Access to a specific playlist is
 * further gated by membership in the service (403/404).
 *
 * - `GET  /`            → the current user's playlists.
 * - `GET  /new`         → create-playlist form (before `/:id`).
 * - `POST /`            → create a playlist (creator becomes OWNER).
 * - `GET  /:id`         → a playlist with its tracks + an add-track form.
 * - `POST /:id/musics`  → add a track to the playlist.
 */
export function createPlaylistRoutes(
  controller: PlaylistController,
  requireAuth: RequestHandler,
): Router {
  const router = Router();

  router.get("/", requireAuth, controller.showList);
  router.get("/new", requireAuth, controller.showCreateForm);
  router.post(
    "/",
    requireAuth,
    validate(createPlaylistSchema),
    controller.create,
  );
  router.get(
    "/:id",
    requireAuth,
    validate(showPlaylistSchema),
    controller.show,
  );
  router.post(
    "/:id/musics",
    requireAuth,
    validate(addMusicSchema),
    controller.addMusic,
  );

  return router;
}
