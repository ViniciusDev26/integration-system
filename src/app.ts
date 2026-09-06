import path from "node:path";
import cookieParser from "cookie-parser";
import express, {
  type Express,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import { engine } from "express-handlebars";
import type { AuthController } from "./modules/auth/auth.controller.types.js";
import { createAuthRoutes } from "./modules/auth/auth.routes.js";
import type { MusicController } from "./modules/music/music.controller.types.js";
import { createMusicRoutes } from "./modules/music/music.routes.js";
import type { PlaylistController } from "./modules/playlist/playlist.controller.types.js";
import { createPlaylistRoutes } from "./modules/playlist/playlist.routes.js";
import type { WebController } from "./modules/web/web.controller.types.js";
import { createWebRoutes } from "./modules/web/web.routes.js";

export interface AppOptions {
  authController: AuthController;
  webController: WebController;
  musicController: MusicController;
  playlistController: PlaylistController;
  /** Route guard for authenticated endpoints (built from the container's authService). */
  requireAuth: RequestHandler;
}

/**
 * Builds and configures the Express application without starting an HTTP
 * listener.
 *
 * Keeping app construction (here) separate from the server bootstrap
 * (`src/server.ts`) lets tests import and exercise the app directly — e.g. with
 * supertest — without binding to a port. Collaborators (controllers) are
 * injected, so the composition root (`src/container.ts`) owns the wiring
 * (ADR 0027).
 */
export function createApp(options: AppOptions): Express {
  const app = express();

  // Server-side views with Handlebars (ADR 0030). `views` is resolved relative
  // to this compiled file, so the same path works under Vitest (src), the dev
  // `dist`, and the production image — the build copies `src/views` → dist/views.
  app.engine("handlebars", engine({ defaultLayout: "main" }));
  app.set("view engine", "handlebars");
  app.set("views", path.join(import.meta.dirname, "views"));

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/", createWebRoutes(options.webController));
  app.use("/auth", createAuthRoutes(options.authController));
  app.use(
    "/musics",
    createMusicRoutes(options.musicController, options.requireAuth),
  );
  app.use(
    "/playlists",
    createPlaylistRoutes(options.playlistController, options.requireAuth),
  );

  return app;
}
