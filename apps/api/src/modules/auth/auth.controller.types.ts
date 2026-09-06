import type { Request, Response } from "express";
import type { ValidatedRequest } from "express-zod-safe";
import type { githubCallbackSchema } from "./auth.controller.js";
import type { AuthService } from "./auth.service.types.js";

export interface AuthControllerOptions {
  authService: AuthService;
  /**
   * Set the `Secure` attribute on auth cookies. Enable in production (HTTPS);
   * disable for plain-HTTP local development (ADR 0016).
   */
  secureCookies: boolean;
}

/** Callback request with `code`/`state` already validated by the route middleware. */
export type GithubCallbackRequest = ValidatedRequest<
  typeof githubCallbackSchema
>;

/**
 * The GitHub OAuth redirect flow (ADR 0020). `me`/`logout` live in the auth tRPC
 * router (ADR 0037), not here.
 */
export interface AuthController {
  startGithubLogin(req: Request, res: Response): void;
  handleGithubCallback(
    req: GithubCallbackRequest,
    res: Response,
  ): Promise<void>;
}
