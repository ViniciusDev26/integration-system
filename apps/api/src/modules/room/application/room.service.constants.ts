/** How much chat history a client gets on arrival (ADR 0044). */
export const DEFAULT_HISTORY_LIMIT = 50;

/**
 * Cap on a single reconnect backfill. A client offline long enough to exceed it
 * is better served by reloading the history than by replaying thousands of
 * messages through the socket.
 */
export const MAX_BACKFILL = 200;
