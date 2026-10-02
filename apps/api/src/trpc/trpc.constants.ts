/**
 * Where the tRPC router is mounted. Both transports share it (ADR 0039): HTTP
 * requests are handled by the Express middleware, and WebSocket upgrades to the
 * same path are handled by the `ws` server. They are distinguished by the
 * `Upgrade` header, not by the path.
 */
export const TRPC_ENDPOINT = "/trpc";

/**
 * Heartbeat interval for WebSocket connections. The adapter pings on this
 * interval and closes the socket if no pong arrives within
 * {@link WS_PONG_WAIT_MS}, so connections dropped without a close frame (a
 * sleeping laptop, a dead NAT entry) are reclaimed instead of lingering.
 */
export const WS_PING_MS = 30_000;

/** How long to wait for a pong before considering the connection dead. */
export const WS_PONG_WAIT_MS = 5_000;
