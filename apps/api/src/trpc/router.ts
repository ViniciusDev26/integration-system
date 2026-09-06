import { createAuthRouter } from "../modules/auth/auth.router.js";
import type { AuthService } from "../modules/auth/auth.service.types.js";
import { createMusicRouter } from "../modules/music/music.router.js";
import type { MusicService } from "../modules/music/music.service.types.js";
import { createPlaylistRouter } from "../modules/playlist/playlist.router.js";
import type { PlaylistService } from "../modules/playlist/playlist.service.types.js";
import type { SessionService } from "../modules/sessions/session.service.types.js";
import { router } from "./trpc.js";

export interface AppRouterDeps {
  authService: AuthService;
  sessionService: SessionService;
  musicService: MusicService;
  playlistService: PlaylistService;
  /** Whether session cookies carry `Secure` (production). */
  secureCookies: boolean;
}

/**
 * The app's root tRPC router (ADR 0037), assembled from the feature routers in
 * the composition root. Its inferred type ({@link AppRouter}) is exported for the
 * web client — end-to-end types with no codegen.
 */
export function createAppRouter(deps: AppRouterDeps) {
  return router({
    auth: createAuthRouter({
      authService: deps.authService,
      sessionService: deps.sessionService,
      secureCookies: deps.secureCookies,
    }),
    musics: createMusicRouter(deps.musicService),
    playlists: createPlaylistRouter(deps.playlistService),
  });
}

/** Type of the root router — imported by `apps/web` for typed calls (no codegen). */
export type AppRouter = ReturnType<typeof createAppRouter>;
