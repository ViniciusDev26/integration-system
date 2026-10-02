import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The SPA is served same-origin in production (api ADR 0036). In dev, proxy the
// API routes to the API app so the httpOnly cookie flows as same-origin.
const API_TARGET = "http://localhost:3000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    proxy: {
      // `ws: true` proxies the WebSocket upgrade too, so subscriptions work in
      // dev exactly as they do same-origin in production (api ADR 0039).
      "/trpc": { target: API_TARGET, changeOrigin: true, ws: true },
      "/auth": { target: API_TARGET, changeOrigin: true },
    },
  },
});
