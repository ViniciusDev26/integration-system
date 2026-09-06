/**
 * Normalized GitHub user returned by the OAuth client. `email` is guaranteed
 * (the adapter resolves the primary verified email); other optional GitHub
 * fields stay nullable.
 */
export interface GitHubUser {
  id: string;
  login: string;
  name: string | null;
  email: string;
  avatarUrl: string | null;
}

/**
 * Port for the GitHub OAuth interaction (ADR 0020/0027). Adapters:
 * `createGitHubOAuthClient` (real, fetch + Zod) and a fake for unit tests.
 */
export interface GitHubOAuthClient {
  getAuthorizationUrl(state: string): string;
  exchangeCodeForToken(code: string): Promise<string>;
  getAuthenticatedUser(accessToken: string): Promise<GitHubUser>;
}
