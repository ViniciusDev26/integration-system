import { Router } from "express";
import validate from "express-zod-safe";
import { githubCallbackSchema } from "./auth.controller.js";
import type { AuthController } from "./auth.controller.types.js";

/**
 * The GitHub OAuth **callback** (ADR 0020) — the only REST auth route (a browser
 * redirect from GitHub). Input validated by `express-zod-safe` (ADR 0012).
 * Login initiation (`auth.startLogin`), `me`, and `logout` are tRPC (ADR 0037).
 *
 * - `GET /github/callback` → verify state, exchange code, set the session cookie.
 */
export function createAuthRoutes(controller: AuthController): Router {
  const router = Router();

  router.get(
    "/github/callback",
    validate(githubCallbackSchema),
    controller.handleGithubCallback,
  );

  return router;
}
