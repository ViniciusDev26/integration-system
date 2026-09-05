import { z } from "zod";
import {
  DEFAULT_GITHUB_SCOPES,
  GITHUB_API_EMAILS_URL,
  GITHUB_API_USER_URL,
  GITHUB_AUTHORIZE_URL,
  GITHUB_TOKEN_URL,
} from "./github-oauth.client.constants.js";
import type {
  FetchFn,
  GitHubOAuthClientOptions,
} from "./github-oauth.client.http.types.js";
import type { GitHubOAuthClient, GitHubUser } from "./github-oauth.client.js";

const tokenResponseSchema = z.union([
  z.object({
    access_token: z.string(),
    token_type: z.string(),
    scope: z.string(),
  }),
  z.object({ error: z.string(), error_description: z.string().optional() }),
]);

const userResponseSchema = z.object({
  id: z.number(),
  login: z.string(),
  name: z.string().nullable().default(null),
  email: z.string().nullable().default(null),
  avatar_url: z.string().nullable().default(null),
});

const emailsResponseSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.boolean(),
  }),
);

async function fetchJson(
  fetchFn: FetchFn,
  url: string,
  accessToken: string,
): Promise<unknown> {
  const response = await fetchFn(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: "application/vnd.github+json",
    },
  });
  const data: unknown = await response.json();
  return data;
}

async function fetchPrimaryVerifiedEmail(
  fetchFn: FetchFn,
  accessToken: string,
): Promise<string | null> {
  const data = await fetchJson(fetchFn, GITHUB_API_EMAILS_URL, accessToken);
  const emails = emailsResponseSchema.parse(data);
  const primary = emails.find((entry) => entry.primary && entry.verified);
  return primary?.email ?? null;
}

/**
 * Real GitHub OAuth adapter for {@link GitHubOAuthClient} (ADR 0020). Talks to
 * GitHub with the injected `fetch` and validates every response with Zod
 * (ADR 0011). `fetch` is injectable so this is unit-tested without network.
 */
export function createGitHubOAuthClient(
  options: GitHubOAuthClientOptions,
): GitHubOAuthClient {
  const { clientId, clientSecret, redirectUri } = options;
  const scopes = options.scopes ?? DEFAULT_GITHUB_SCOPES;
  const fetchFn = options.fetch ?? fetch;

  return {
    getAuthorizationUrl(state) {
      const url = new URL(GITHUB_AUTHORIZE_URL);
      url.searchParams.set("client_id", clientId);
      url.searchParams.set("redirect_uri", redirectUri);
      url.searchParams.set("scope", scopes.join(" "));
      url.searchParams.set("state", state);
      return url.toString();
    },

    async exchangeCodeForToken(code) {
      const response = await fetchFn(GITHUB_TOKEN_URL, {
        method: "POST",
        headers: { accept: "application/json" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
      });
      const data: unknown = await response.json();
      const parsed = tokenResponseSchema.parse(data);

      if ("error" in parsed) {
        throw new Error(`GitHub token exchange failed: ${parsed.error}`);
      }
      return parsed.access_token;
    },

    async getAuthenticatedUser(accessToken): Promise<GitHubUser> {
      const profile = userResponseSchema.parse(
        await fetchJson(fetchFn, GITHUB_API_USER_URL, accessToken),
      );
      const email =
        profile.email ??
        (await fetchPrimaryVerifiedEmail(fetchFn, accessToken));

      if (email === null) {
        throw new Error("GitHub user has no verified primary email");
      }

      return {
        id: String(profile.id),
        login: profile.login,
        name: profile.name,
        email,
        avatarUrl: profile.avatar_url,
      };
    },
  };
}
