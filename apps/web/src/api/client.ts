import type { AppRouter } from "@integration-system/api/trpc";
import { createTRPCClient } from "@trpc/client";
import { apiLinks } from "./links";

/**
 * A standalone (non-React) typed tRPC client for use outside components — e.g.
 * the auth store's actions (ADR 0010). Still fully typed via `AppRouter`.
 */
export const apiClient = createTRPCClient<AppRouter>({ links: apiLinks() });
