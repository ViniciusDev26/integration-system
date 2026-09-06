import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { apiLinks } from "./links";
import { trpc } from "./trpc";

/**
 * Wires the tRPC client + TanStack Query (ADR 0008). The batch link points at
 * the same-origin `/trpc` (dev-proxied to the API), sending credentials so the
 * httpOnly session cookie rides along (web ADR 0007).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() => trpc.createClient({ links: apiLinks() }));

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
