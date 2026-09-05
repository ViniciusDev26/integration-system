import type { Request, Response } from "express";
import type { ValidatedRequest } from "express-zod-safe";
import type { createMusicSchema } from "./music.controller.js";
import type { MusicService } from "./music.service.types.js";

export interface MusicControllerOptions {
  musicService: MusicService;
}

/** Create request with `name`/`genre` already validated by the route middleware. */
export type CreateMusicRequest = ValidatedRequest<typeof createMusicSchema>;

/**
 * HTTP layer for music (ADR 0018/0027). Handlers translate between HTTP
 * (multipart upload, status codes) and the {@link MusicService}; they hold no
 * business logic and never parse raw input (ADR 0012).
 */
export interface MusicController {
  /** Renders the upload form page (ADR 0030). */
  showUploadForm(req: Request, res: Response): void;
  create(req: CreateMusicRequest, res: Response): Promise<void>;
}
