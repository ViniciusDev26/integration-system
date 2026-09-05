import type { Request, Response } from "express";
import type { AuthService } from "../auth/auth.service.types.js";

export interface WebControllerOptions {
  authService: AuthService;
}

/** View model for the current user, shaped for the templates (no raw DB row). */
export interface CurrentUserView {
  displayName: string;
  email: string;
  imageUrl: string | null;
}

/**
 * Server-rendered pages (ADR 0030). Controllers resolve a view model and hand it
 * to Handlebars; templates stay logic-less.
 */
export interface WebController {
  home(req: Request, res: Response): Promise<void>;
}
