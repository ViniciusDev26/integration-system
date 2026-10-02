import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import type { WSUpgradeOptions } from "./context.js";
import { router } from "./trpc.js";
import { attachTRPCWebSocketServer } from "./ws-server.js";

/**
 * Exercises the wiring this app owns — that an upgrade on the tRPC endpoint is
 * accepted, that nothing else is, and that the handshake's cookie header
 * reaches `createContext`. Streaming a subscription is tRPC's own code and is
 * not re-tested here; the context factory has its own unit tests.
 */

const emptyRouter = router({});

interface Harness {
  port: number;
  httpServer: Server;
  close: () => Promise<void>;
}

const harnesses: Harness[] = [];

async function startHarness(
  createContext: Parameters<
    typeof attachTRPCWebSocketServer
  >[0]["createContext"],
): Promise<Harness> {
  const httpServer = createServer();
  const wsServer = attachTRPCWebSocketServer({
    httpServer,
    router: emptyRouter,
    createContext,
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, resolve);
  });
  const address = httpServer.address();
  const port =
    typeof address === "object" && address !== null ? address.port : 0;

  const harness: Harness = {
    port,
    httpServer,
    close: async () => {
      wsServer.close();
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    },
  };
  harnesses.push(harness);
  return harness;
}

afterEach(async () => {
  await Promise.all(harnesses.splice(0).map((harness) => harness.close()));
});

/** Resolves true if the socket opens, false if the upgrade is refused. */
function tryConnect(url: string, cookie?: string): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new WebSocket(
      url,
      cookie === undefined ? undefined : { headers: { cookie } },
    );
    socket.on("open", () => {
      socket.close();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

describe("attachTRPCWebSocketServer", () => {
  it("accepts a WebSocket upgrade on the tRPC endpoint", async () => {
    const { port } = await startHarness(async () => ({
      req: { cookies: {} },
      res: { cookie: () => undefined, clearCookie: () => undefined },
      user: null,
    }));

    await expect(tryConnect(`ws://127.0.0.1:${port}/trpc`)).resolves.toBe(true);
  });

  it("refuses an upgrade on any other path", async () => {
    const { port } = await startHarness(async () => ({
      req: { cookies: {} },
      res: { cookie: () => undefined, clearCookie: () => undefined },
      user: null,
    }));

    await expect(tryConnect(`ws://127.0.0.1:${port}/socket`)).resolves.toBe(
      false,
    );
  });

  it("hands the handshake cookie header to createContext", async () => {
    const createContext = vi.fn(async (_opts: WSUpgradeOptions) => ({
      req: { cookies: {} },
      res: { cookie: () => undefined, clearCookie: () => undefined },
      user: null,
    }));
    const { port } = await startHarness(createContext);

    await tryConnect(`ws://127.0.0.1:${port}/trpc`, "session=sess-abc");
    // The adapter builds the context lazily, on connection.
    await vi.waitFor(() => expect(createContext).toHaveBeenCalled());

    const [firstCall] = createContext.mock.calls;
    expect(firstCall?.[0]?.req.headers.cookie).toBe("session=sess-abc");
  });
});
