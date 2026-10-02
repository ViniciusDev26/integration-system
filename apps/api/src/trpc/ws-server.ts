import type { Server as HttpServer } from "node:http";
import type { AnyRouter } from "@trpc/server";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import { WebSocketServer } from "ws";
import type { Context, WSUpgradeOptions } from "./context.js";
import {
  TRPC_ENDPOINT,
  WS_PING_MS,
  WS_PONG_WAIT_MS,
} from "./trpc.constants.js";

export interface TRPCWebSocketServerOptions<TRouter extends AnyRouter> {
  /** The HTTP server to share a port with; upgrades are handled on it. */
  httpServer: HttpServer;
  router: TRouter;
  /** Resolves the session from the handshake — see `createWSContextFactory`. */
  createContext: (opts: WSUpgradeOptions) => Promise<Context>;
}

export interface TRPCWebSocketServer {
  /**
   * Asks connected clients to reconnect, then stops accepting connections.
   * `wsLink` reconnects with backoff and re-sends its pending subscriptions, so
   * a restart resumes streams rather than stranding them.
   */
  close: () => void;
}

/**
 * Serves tRPC subscriptions over WebSocket on the same port and path as the
 * HTTP transport (ADR 0039). Upgrades are routed by the `Upgrade` header, so
 * `/trpc` keeps working for queries and mutations through Express.
 *
 * The heartbeat is on: a connection whose peer vanished without a close frame
 * (a slept laptop, a dropped NAT entry) is reclaimed instead of lingering.
 */
export function attachTRPCWebSocketServer<TRouter extends AnyRouter>(
  options: TRPCWebSocketServerOptions<TRouter>,
): TRPCWebSocketServer {
  const wss = new WebSocketServer({
    server: options.httpServer,
    path: TRPC_ENDPOINT,
  });

  const handler = applyWSSHandler({
    wss,
    router: options.router,
    createContext: options.createContext,
    keepAlive: {
      enabled: true,
      pingMs: WS_PING_MS,
      pongWaitMs: WS_PONG_WAIT_MS,
    },
  });

  return {
    close: () => {
      handler.broadcastReconnectNotification();
      wss.close();
    },
  };
}
