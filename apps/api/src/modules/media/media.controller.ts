import { z } from "zod";
import { readCookie } from "../../shared/http/cookies.js";
import { SESSION_COOKIE } from "../auth/http/auth.controller.constants.js";
import { REDIRECT_SIGNED_URL_TTL_SECONDS } from "./media.constants.js";
import type {
  MediaController,
  MediaControllerOptions,
} from "./media.controller.types.js";

/**
 * Route params arrive untyped from Express; validate at the boundary (ADR 0011).
 * Only presence is checked — the repository lookup is the authority on whether
 * a track exists, so pinning the id *format* here would buy nothing and would
 * couple the route to the id scheme.
 */
const paramsSchema = z.object({ musicId: z.string().min(1) });

/**
 * Serves media from our own origin as a **redirect** (ADR 0045).
 *
 * The client is given a path that never expires; each request mints a
 * short-lived signed URL and sends a 302 to it. The bytes still travel directly
 * from R2 to the browser — only the addressing passes through here, so ADR 0038
 * still holds and audio never enters this process.
 */
export function createMediaController(
  options: MediaControllerOptions,
): MediaController {
  const { authService, musicRepository, objectStorage } = options;

  /**
   * Resolves the request to an object key, or writes the failing response and
   * returns `null`. Media requires a session: without this, a captured path
   * would serve the object to anyone.
   */
  async function resolveKey(
    req: Parameters<MediaController["redirectToPlayback"]>[0],
    res: Parameters<MediaController["redirectToPlayback"]>[1],
    pick: "audio" | "cover",
  ): Promise<string | null> {
    const sessionId = readCookie(req, SESSION_COOKIE);
    const user =
      sessionId.length > 0 ? await authService.getCurrentUser(sessionId) : null;
    if (user === null) {
      res.status(401).json({ error: "unauthorized" });
      return null;
    }

    const params = paramsSchema.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "missing_music_id" });
      return null;
    }

    const music = await musicRepository.findById(params.data.musicId);
    if (music === null) {
      res.status(404).json({ error: "music_not_found" });
      return null;
    }

    const key = pick === "audio" ? music.objectKey : music.thumbnailObjectKey;
    if (key === null) {
      res.status(404).json({ error: "no_cover" });
      return null;
    }

    return key;
  }

  async function redirect(
    req: Parameters<MediaController["redirectToPlayback"]>[0],
    res: Parameters<MediaController["redirectToPlayback"]>[1],
    pick: "audio" | "cover",
  ): Promise<void> {
    const key = await resolveKey(req, res, pick);
    if (key === null) {
      return;
    }

    const url = await objectStorage.getSignedUrl(key, {
      expiresInSeconds: REDIRECT_SIGNED_URL_TTL_SECONDS,
    });

    // Never cache the redirect: caching it would pin one signed URL and bring
    // expiry straight back (ADR 0045).
    res.setHeader("Cache-Control", "no-store");
    res.redirect(302, url);
  }

  return {
    redirectToPlayback: (req, res) => redirect(req, res, "audio"),
    redirectToCover: (req, res) => redirect(req, res, "cover"),
  };
}
