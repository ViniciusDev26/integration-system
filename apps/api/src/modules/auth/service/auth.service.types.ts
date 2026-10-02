import type { Session } from "../../../shared/db/schema/sessions.js";
import type { User } from "../../../shared/db/schema/users.js";
import type { SessionService } from "../../sessions/service/session.service.types.js";
import type { UserRepository } from "../../users/user.repository.js";
import type { GitHubOAuthClient } from "../oauth/github-oauth.client.js";
import type { PasswordHasher } from "../password/password-hasher.js";

export interface AuthServiceOptions {
  githubClient: GitHubOAuthClient;
  userRepository: UserRepository;
  sessionService: SessionService;
  /** Derives and checks password hashes (ADR 0043). */
  passwordHasher: PasswordHasher;
  /** CSRF state generator, injectable for tests. Defaults to a random token. */
  generateState?: () => string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string | null;
}

export interface PasswordLoginInput {
  email: string;
  password: string;
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
 * Orchestrates both ways in: GitHub OAuth (ADR 0020) and email/password
 * (ADR 0043). Both end at the same server-side session (ADR 0016), so nothing
 * downstream of login knows which route was taken.
 */
export interface AuthService {
  getLoginUrl(): LoginUrl;
  handleCallback(input: HandleCallbackInput): Promise<Session>;
  /**
   * Creates a password account and signs it in (ADR 0043). Refuses an address
   * that already has an account, since nothing here proves it is yours.
   */
  register(input: RegisterInput): Promise<Session>;
  /**
   * Signs in with email and password. Every failure is the same error, and a
   * missing account costs the same time as a wrong password.
   */
  loginWithPassword(input: PasswordLoginInput): Promise<Session>;
  /**
   * Resolves the authenticated user from a session id (e.g. the cookie value):
   * validates the session and loads its user. Returns `null` when the session is
   * missing, invalid, or expired. Used by the web layer to render auth state.
   */
  getCurrentUser(sessionId: string): Promise<User | null>;
}
