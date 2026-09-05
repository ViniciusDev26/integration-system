import type { GitHubOAuthClient, GitHubUser } from "./github-oauth.client.js";

export interface FakeGitHubOAuthClientOptions {
  authorizationUrl?: string;
  /** code -> access token */
  tokensByCode?: Record<string, string>;
  /** access token -> user */
  usersByToken?: Record<string, GitHubUser>;
}

/**
 * In-memory fake of {@link GitHubOAuthClient} for unit tests (ADR 0027).
 * Not shipped in the build.
 */
export function createFakeGitHubOAuthClient(
  options: FakeGitHubOAuthClientOptions = {},
): GitHubOAuthClient {
  const authorizationUrl =
    options.authorizationUrl ?? "https://github.test/login/oauth/authorize";
  const tokensByCode = options.tokensByCode ?? {};
  const usersByToken = options.usersByToken ?? {};

  return {
    getAuthorizationUrl(state) {
      const url = new URL(authorizationUrl);
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCodeForToken(code) {
      const token = tokensByCode[code];
      if (token === undefined) {
        throw new Error(`fake github client: unknown code "${code}"`);
      }
      return token;
    },

    async getAuthenticatedUser(accessToken) {
      const user = usersByToken[accessToken];
      if (user === undefined) {
        throw new Error(`fake github client: unknown token "${accessToken}"`);
      }
      return user;
    },
  };
}
