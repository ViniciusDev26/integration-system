import type { Request, Response } from "express";
import type { ObjectStorage } from "../../shared/storage/object-storage.js";
import type { AuthService } from "../auth/service/auth.service.types.js";
import type { MusicRepository } from "../music/repository/music.repository.js";

export interface MediaControllerOptions {
  /** Resolves the session cookie — media requires a signed-in user (ADR 0045). */
  authService: Pick<AuthService, "getCurrentUser">;
  /** Looks up the object keys for a track. */
  musicRepository: Pick<MusicRepository, "findById">;
  /** Mints the short-lived signed URL each redirect points at. */
  objectStorage: Pick<ObjectStorage, "getSignedUrl">;
}

export interface MediaController {
  /** 302 to a freshly signed URL for the track's audio. */
  redirectToPlayback(req: Request, res: Response): Promise<void>;
  /** 302 to a freshly signed URL for the track's cover, or 404 if it has none. */
  redirectToCover(req: Request, res: Response): Promise<void>;
}
