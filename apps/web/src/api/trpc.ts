import type { AppRouter } from "@integration-system/api/trpc";
import { createTRPCReact } from "@trpc/react-query";

/**
 * The typed tRPC React hooks (ADR 0008). `AppRouter` is imported from the API
 * package (type-only, across the workspace) — end-to-end types, no codegen.
 */
export const trpc = createTRPCReact<AppRouter>();
