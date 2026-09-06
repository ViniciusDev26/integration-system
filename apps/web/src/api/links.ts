import { httpBatchLink } from "@trpc/client";

/**
 * tRPC links shared by the React client (Providers) and the standalone client
 * (the auth store). Same-origin `/trpc` (dev-proxied), sending credentials so the
 * httpOnly session cookie rides along (web ADR 0007).
 */
export function apiLinks() {
  return [
    httpBatchLink({
      url: "/trpc",
      fetch(url, options) {
        return fetch(url, { ...options, credentials: "include" });
      },
    }),
  ];
}
