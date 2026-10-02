import { Router } from "express";
import type { MediaController } from "./media.controller.types.js";

/**
 * Media routes (ADR 0045). Plain REST rather than tRPC for the same reason the
 * OAuth callback is: the browser navigates these itself, via `<audio>` and
 * `<img>`, and tRPC is JSON-RPC.
 */
export function createMediaRoutes(controller: MediaController): Router {
  const router = Router();

  router.get("/musics/:musicId", (req, res, next) => {
    controller.redirectToPlayback(req, res).catch(next);
  });

  router.get("/musics/:musicId/cover", (req, res, next) => {
    controller.redirectToCover(req, res).catch(next);
  });

  return router;
}
