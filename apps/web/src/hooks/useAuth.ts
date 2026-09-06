import { trpc } from "../api/trpc";

/**
 * Current-user state via the `auth.me` tRPC query. A 401 (anonymous) surfaces as
 * an error with `data` undefined — treated as "signed out"; we don't retry it.
 */
export function useAuth() {
  const me = trpc.auth.me.useQuery(undefined, {
    retry: false,
    staleTime: 60_000,
  });

  return {
    user: me.data ?? null,
    isSignedIn: me.data != null,
    isLoading: me.isLoading,
  };
}
