export type FetchFn = typeof fetch;

export interface GitHubOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** OAuth scopes. Defaults to `read:user user:email`. */
  scopes?: readonly string[];
  /** Injectable fetch, for tests. Defaults to the global `fetch`. */
  fetch?: FetchFn;
}
