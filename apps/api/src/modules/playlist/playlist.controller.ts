import type { Response } from "express";
import { z } from "zod";
import { getAuthenticatedUser } from "../auth/require-auth.js";
import type {
  PlaylistController,
  PlaylistControllerOptions,
} from "./playlist.controller.types.js";
import {
  MusicNotFoundError,
  PlaylistForbiddenError,
  PlaylistNotFoundError,
} from "./playlist.service.errors.js";

/** Body schema for `POST /playlists` (ADR 0012). */
export const createPlaylistSchema = {
  body: z.object({ name: z.string().min(1) }),
};

/** Params schema for `GET /playlists/:id` (ADR 0012). */
export const showPlaylistSchema = {
  params: z.object({ id: z.string().min(1) }),
};

/** Params + body schema for `POST /playlists/:id/musics` (ADR 0012). */
export const addMusicSchema = {
  params: z.object({ id: z.string().min(1) }),
  body: z.object({ musicId: z.string().min(1) }),
};

/**
 * Maps a {@link PlaylistService} domain error to an HTTP response. Returns `true`
 * if it handled the error, `false` to let the caller rethrow (unexpected).
 */
function respondToError(err: unknown, res: Response): boolean {
  if (err instanceof PlaylistForbiddenError) {
    res.status(403).json({ error: "forbidden" });
    return true;
  }
  if (
    err instanceof PlaylistNotFoundError ||
    err instanceof MusicNotFoundError
  ) {
    res.status(404).json({ error: "not_found" });
    return true;
  }
  return false;
}

export function createPlaylistController(
  options: PlaylistControllerOptions,
): PlaylistController {
  const { playlistService, musicService } = options;

  return {
    async showList(_req, res) {
      const user = getAuthenticatedUser(res);
      const playlists = await playlistService.listForUser(user.id);
      res.render("playlist-list", {
        title: "Your playlists — Spotifake",
        playlists,
      });
    },

    showCreateForm(_req, res) {
      res.render("playlist-new", { title: "New playlist — Spotifake" });
    },

    async create(req, res) {
      const user = getAuthenticatedUser(res);
      const playlist = await playlistService.createForUser({
        name: req.body.name,
        ownerId: user.id,
      });
      res.redirect(303, `/playlists/${playlist.id}`);
    },

    async show(req, res) {
      const user = getAuthenticatedUser(res);
      try {
        const { playlist, musics } = await playlistService.getWithMusics({
          playlistId: req.params.id,
          requesterId: user.id,
        });
        // All tracks, offered in the "add a track" <select> on the page.
        const allMusics = await musicService.listAll();
        res.render("playlist-detail", {
          title: `${playlist.name} — Spotifake`,
          playlist,
          musics,
          allMusics,
        });
      } catch (err) {
        if (!respondToError(err, res)) throw err;
      }
    },

    async addMusic(req, res) {
      const user = getAuthenticatedUser(res);
      try {
        await playlistService.addMusic({
          playlistId: req.params.id,
          musicId: req.body.musicId,
          requesterId: user.id,
        });
        res.redirect(303, `/playlists/${req.params.id}`);
      } catch (err) {
        if (!respondToError(err, res)) throw err;
      }
    },
  };
}
