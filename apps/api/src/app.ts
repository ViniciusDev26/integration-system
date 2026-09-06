import { existsSync } from "node:fs";
import path from "node:path";
import {
  type CreateExpressContextOptions,
  createExpressMiddleware,
} from "@trpc/server/adapters/express";
import cookieParser from "cookie-parser";
import express, { type Express, type Request, type Response } from "express";
import type { AuthController } from "./modules/auth/http/auth.controller.types.js";
import { createAuthRoutes } from "./modules/auth/http/auth.routes.js";
import type { Context } from "./trpc/context.js";
import type { AppRouter } from "./trpc/router.js";

export interface AppOptions {
  /** GitHub OAuth redirect flow (the only non-tRPC HTTP). */
  authController: AuthController;
  /** The root tRPC router (ADR 0037), mounted at `/trpc`. */
  trpcRouter: AppRouter;
  /** Per-request tRPC context factory (resolves the current user). */
  createContext: (opts: CreateExpressContextOptions) => Promise<Context>;
}

/** Where the built SPA (`apps/web/dist`) lives, relative to this module. */
const WEB_CLIENT_DIR = path.join(
  import.meta.dirname,
  "..",
  "..",
  "web",
  "dist",
);

/**
 * Builds the Express app without starting a listener (so tests can import it).
 * The app is a **tRPC API** at `/trpc` (ADR 0037) plus the GitHub OAuth redirect
 * flow at `/auth`; it also serves the built SPA same-origin (ADR 0036).
 */
export function createApp(options: AppOptions): Express {
  const app = express();

  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());
  app.use(cookieParser());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use(
    "/trpc",
    createExpressMiddleware({
      router: options.trpcRouter,
      createContext: options.createContext,
    }),
  );

  app.use("/auth", createAuthRoutes(options.authController));

  mountWebClient(app);

  return app;
}

/**
 * Serve the built SPA (`apps/web/dist`) same-origin (ADR 0036): static assets
 * plus an SPA fallback for non-`/trpc`/`/auth` GETs. Guarded — inert until the
 * SPA is built.
 */
function mountWebClient(app: Express): void {
  const indexHtml = path.join(WEB_CLIENT_DIR, "index.html");
  if (!existsSync(indexHtml)) {
    return;
  }

  app.use(express.static(WEB_CLIENT_DIR));
  app.use((req: Request, res: Response, next) => {
    if (
      req.method !== "GET" ||
      req.path.startsWith("/trpc") ||
      req.path.startsWith("/auth")
    ) {
      next();
      return;
    }
    res.sendFile(indexHtml);
  });
}
