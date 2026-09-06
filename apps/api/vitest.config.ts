import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Repository integration tests start a Docker container (Testcontainers,
    // ADR 0015), so hooks/tests need generous timeouts.
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
