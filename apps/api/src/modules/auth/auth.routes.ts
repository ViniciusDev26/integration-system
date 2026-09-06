import { Router } from "express";
import validate from "express-zod-safe";
import { githubCallbackSchema } from "./auth.controller.js";
import type { AuthController } from "./auth.controller.types.js";

/**
 * GitHub OAuth routes (ADR 0020). Input is validated by `express-zod-safe`
 * middleware at the route layer (ADR 0012); handlers receive typed data.
 *
 * - `GET  /github`          → redirect to GitHub, issue the CSRF `state` cookie.
 * - `GET  /github/callback` → verify state, exchange code, set the session cookie.
 *
 * `me`/`logout` are tRPC procedures (ADR 0037), not routes here.
 */
export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.get("/github", controller.startGithubLogin);
  router.get(
    "/github/callback",
    validate(githubCallbackSchema),
    controller.handleGithubCallback,
  );

  return router;
}
