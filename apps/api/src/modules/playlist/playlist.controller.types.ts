import type { Request, Response } from "express";
import type { ValidatedRequest } from "express-zod-safe";
import type { MusicService } from "../music/music.service.types.js";
import type {
  addMusicSchema,
  createPlaylistSchema,
  showPlaylistSchema,
} from "./playlist.controller.js";
import type { PlaylistService } from "./playlist.service.types.js";

export interface PlaylistControllerOptions {
  playlistService: PlaylistService;
  /** Provides the list of all tracks for the "add a track" picker. */
  musicService: MusicService;
}

export type CreatePlaylistRequest = ValidatedRequest<
  typeof createPlaylistSchema
>;
export type ShowPlaylistRequest = ValidatedRequest<typeof showPlaylistSchema>;
export type AddMusicRequest = ValidatedRequest<typeof addMusicSchema>;

/**
 * HTTP layer for playlists (ADR 0018/0027). Handlers translate between HTTP and
 * the {@link PlaylistService}; they hold no business logic (ADR 0012) and map the
 * service's domain errors to 403/404.
 */
export interface PlaylistController {
  showList(req: Request, res: Response): Promise<void>;
  showCreateForm(req: Request, res: Response): void;
  create(req: CreatePlaylistRequest, res: Response): Promise<void>;
  show(req: ShowPlaylistRequest, res: Response): Promise<void>;
  addMusic(req: AddMusicRequest, res: Response): Promise<void>;
}
