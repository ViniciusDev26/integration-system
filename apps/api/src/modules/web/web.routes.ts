import { Router } from "express";
import type { WebController } from "./web.controller.types.js";

/**
 * Server-rendered page routes (ADR 0030).
 *
 * - `GET /` → home page: shows the signed-in user (GitHub avatar/name + logout)
 *   or a "Sign in with GitHub" call to action.
 */
export function createWebRoutes(controller: WebController): Router {
  const router = Router();

  router.get("/", controller.home);

  return router;
}
