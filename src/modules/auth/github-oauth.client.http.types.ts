import type { AxiosInstance } from "axios";

export interface GitHubOAuthClientOptions {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** OAuth scopes. Defaults to `read:user user:email`. */
  scopes?: readonly string[];
  /** Injectable axios instance, for tests. Defaults to `axios.create()`. */
  httpClient?: AxiosInstance;
}
