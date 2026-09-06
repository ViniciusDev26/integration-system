import { create } from "zustand";
import { apiClient } from "../api/client";

/** The current user shape, inferred end-to-end from the `auth.me` procedure. */
type AuthUser = Awaited<ReturnType<typeof apiClient.auth.me.query>>;

type AuthStatus =
  | "loading" // initial session check in flight
  | "authenticating" // login started (redirecting to GitHub)
  | "authenticated"
  | "anonymous";

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  /** Resolve the session on app load (and after returning from OAuth). */
  fetchMe: () => Promise<void>;
  /** Begin GitHub login: flips to `authenticating` then redirects the browser. */
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Global auth/session state (ADR 0010). Login/logout are store actions with an
 * `authenticating` status the UI uses to show progress. Server *data* stays in
 * TanStack Query (ADR 0008); this store is only the session/identity.
 */
export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "loading",

  async fetchMe() {
    try {
      const user = await apiClient.auth.me.query();
      set({ user, status: "authenticated" });
    } catch {
      set({ user: null, status: "anonymous" });
    }
  },

  async login() {
    set({ status: "authenticating" });
    try {
      const { url } = await apiClient.auth.startLogin.mutate();
      window.location.href = url;
    } catch {
      set({ status: "anonymous" });
    }
  },

  async logout() {
    await apiClient.auth.logout.mutate();
    set({ user: null, status: "anonymous" });
  },
}));
