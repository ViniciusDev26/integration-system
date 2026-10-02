import { createServer } from "node:http";
import { createApp } from "./app.js";
import { createContainer } from "./container.js";
import { createAuthController } from "./modules/auth/http/auth.controller.js";
import { createMediaController } from "./modules/media/media.controller.js";
import { env } from "./shared/env.js";
import {
  createContextFactory,
  createWSContextFactory,
} from "./trpc/context.js";
import { createAppRouter } from "./trpc/router.js";
import { TRPC_ENDPOINT } from "./trpc/trpc.constants.js";
import { attachTRPCWebSocketServer } from "./trpc/ws-server.js";

const {
  authService,
  sessionService,
  musicService,
  playlistService,
  inviteService,
  roomService,
  musicRepository,
  objectStorage,
} = createContainer();

const secureCookies = env.NODE_ENV === "production";

const authController = createAuthController({ authService, secureCookies });

// Media is served from our own origin as a redirect, so the URL the client
// holds never expires (ADR 0045).
const mediaController = createMediaController({
  authService,
  musicRepository,
  objectStorage,
});

const trpcRouter = createAppRouter({
  authService,
  sessionService,
  musicService,
  playlistService,
  inviteService,
  roomService,
  secureCookies,
});
const createContext = createContextFactory(authService);

const app = createApp({
  authController,
  mediaController,
  trpcRouter,
  createContext,
});

// An explicit http.Server (rather than app.listen) so the WebSocket server can
// share the port: one origin, one port, both transports (ADR 0039).
const httpServer = createServer(app);

const wsServer = attachTRPCWebSocketServer({
  httpServer,
  router: trpcRouter,
  createContext: createWSContextFactory(authService),
});

httpServer.listen(env.PORT, () => {
  console.log(`Server listening on http://localhost:${env.PORT}`);
  console.log(
    `tRPC subscriptions on ws://localhost:${env.PORT}${TRPC_ENDPOINT}`,
  );
});

function shutdown(): void {
  wsServer.close();
  httpServer.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
