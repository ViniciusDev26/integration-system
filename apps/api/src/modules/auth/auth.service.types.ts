import type { Session } from "../../shared/db/schema/sessions.js";
import type { User } from "../../shared/db/schema/users.js";
import type { SessionService } from "../sessions/session.service.types.js";
import type { UserRepository } from "../users/user.repository.js";
import type { GitHubOAuthClient } from "./github-oauth.client.js";

export interface AuthServiceOptions {
  githubClient: GitHubOAuthClient;
  userRepository: UserRepository;
  sessionService: SessionService;
  /** CSRF state generator, injectable for tests. Defaults to a random token. */
  generateState?: () => string;
}

export interface LoginUrl {
  url: string;
  state: string;
}

export interface HandleCallbackInput {
  code: string;
  /** The `state` returned by GitHub. */
  state: string;
  /** The `state` we issued and stored (e.g. in a cookie). */
  expectedState: string;
}

/**
 * Orchestrates the GitHub OAuth login (ADR 0020): build the authorization URL
 * with a CSRF `state`, then on callback verify the state, exchange the code,
 * upsert the user, and create a session.
 */
export interface AuthService {
  getLoginUrl(): LoginUrl;
  handleCallback(input: HandleCallbackInput): Promise<Session>;
  /**
   * Resolves the authenticated user from a session id (e.g. the cookie value):
   * validates the session and loads its user. Returns `null` when the session is
   * missing, invalid, or expired. Used by the web layer to render auth state.
   */
  getCurrentUser(sessionId: string): Promise<User | null>;
}
