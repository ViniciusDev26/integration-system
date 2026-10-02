import { createWSClient, httpBatchLink, splitLink, wsLink } from "@trpc/client";

/** Close an idle socket after this long with no messages and no subscriptions. */
const WS_IDLE_CLOSE_MS = 10_000;

/**
 * The WebSocket URL for `/trpc`, same-origin so the session cookie is sent on
 * the upgrade (the browser attaches cookies to the handshake). `wss:` follows
 * from an `https:` page.
 */
function trpcWebSocketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/trpc`;
}

/**
 * One WebSocket client for the whole tab.
 *
 * `apiLinks()` is called twice — once for the React client, once for the
 * standalone client used by the auth store — and each call must reuse this
 * socket rather than open its own. One socket per tab is the property ADR 0039
 * was chosen for; creating one per caller would quietly give it up.
 */
let sharedWSClient: ReturnType<typeof createWSClient> | null = null;

function getWSClient() {
  sharedWSClient ??= createWSClient({
    url: trpcWebSocketUrl,
    // Nothing subscribes on most screens, so stay closed until the first
    // subscription and hang up again once the last one ends.
    lazy: { enabled: true, closeMs: WS_IDLE_CLOSE_MS },
  });
  return sharedWSClient;
}

/**
 * tRPC links shared by the React client (Providers) and the standalone client
 * (the auth store).
 *
 * Two transports, one router (ADR 0039): subscriptions go over the WebSocket,
 * while queries and mutations keep using same-origin `/trpc` over HTTP with
 * credentials, so the httpOnly session cookie rides along (web ADR 0007).
 */
export function apiLinks() {
  return [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: wsLink({ client: getWSClient() }),
      false: httpBatchLink({
        url: "/trpc",
        fetch(url, options) {
          return fetch(url, { ...options, credentials: "include" });
        },
      }),
    }),
  ];
}
