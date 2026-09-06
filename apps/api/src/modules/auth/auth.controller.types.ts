import type { Request, Response } from "express";
import type { ValidatedRequest } from "express-zod-safe";
import type { SessionService } from "../sessions/session.service.types.js";
import type { githubCallbackSchema } from "./auth.controller.js";
import type { AuthService } from "./auth.service.types.js";

export interface AuthControllerOptions {
  authService: AuthService;
  sessionService: SessionService;
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
 * HTTP layer for the GitHub OAuth login (ADR 0020). Handlers translate between
 * HTTP (cookies, redirects, status codes) and the {@link AuthService}; they hold
 * no business logic and never parse raw input (ADR 0012).
 */
export interface AuthController {
  startGithubLogin(req: Request, res: Response): void;
  handleGithubCallback(
    req: GithubCallbackRequest,
    res: Response,
  ): Promise<void>;
  logout(req: Request, res: Response): Promise<void>;
}
