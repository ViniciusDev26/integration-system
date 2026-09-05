import express, { type Express, type Request, type Response } from "express";

/**
 * Builds and configures the Express application without starting an HTTP
 * listener.
 *
 * Keeping app construction (here) separate from the server bootstrap
 * (`src/server.ts`) lets tests import and exercise the app directly — e.g. with
 * supertest — without binding to a port.
 */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  return app;
}
