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
  /**
   * Sign in with email and password (api ADR 0043). Unlike GitHub login there
   * is no redirect — the session cookie is set by the mutation, so the store
   * only has to resolve who that is.
   */
  loginWithPassword: (email: string, password: string) => Promise<void>;
  /** Create a password account and sign in (api ADR 0043). */
  register: (
    email: string,
    password: string,
    name: string | null,
  ) => Promise<void>;
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

  async loginWithPassword(email, password) {
    set({ status: "authenticating" });
    try {
      await apiClient.auth.login.mutate({ email, password });
      await useAuthStore.getState().fetchMe();
    } catch (error) {
      // Back to anonymous so the form is usable again; the page shows why.
      set({ status: "anonymous" });
      throw error;
    }
  },

  async register(email, password, name) {
    set({ status: "authenticating" });
    try {
      await apiClient.auth.register.mutate({ email, password, name });
      await useAuthStore.getState().fetchMe();
    } catch (error) {
      set({ status: "anonymous" });
      throw error;
    }
  },

  async logout() {
    await apiClient.auth.logout.mutate();
    set({ user: null, status: "anonymous" });
  },
}));
