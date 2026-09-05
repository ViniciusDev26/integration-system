import axios, { type AxiosAdapter, type AxiosInstance } from "axios";
import { describe, expect, it } from "vitest";
import {
  GITHUB_API_EMAILS_URL,
  GITHUB_API_USER_URL,
  GITHUB_TOKEN_URL,
} from "./github-oauth.client.constants.js";
import { createGitHubOAuthClient } from "./github-oauth.client.http.js";

interface MockRoute {
  method: "get" | "post";
  url: string;
  status: number;
  data: unknown;
}

/** An axios instance whose native adapter answers from `routes` (no network). */
function createMockHttp(routes: readonly MockRoute[]): AxiosInstance {
  const adapter: AxiosAdapter = async (config) => {
    const method = (config.method ?? "get").toLowerCase();
    const url = config.url ?? "";
    const route = routes.find((r) => r.method === method && r.url === url);
    if (route === undefined) {
      throw new Error(`no mock route for ${method} ${url}`);
    }
    return {
      data: route.data,
      status: route.status,
      statusText: "OK",
      headers: {},
      config,
    };
  };
  return axios.create({ adapter });
}

const baseOptions = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "http://localhost:3000/auth/github/callback",
};

function makeClient(routes: readonly MockRoute[] = []) {
  return createGitHubOAuthClient({
    ...baseOptions,
    httpClient: createMockHttp(routes),
  });
}

describe("GitHubOAuthClient (http, axios)", () => {
  it("builds an authorization URL with client_id, redirect_uri, scope, state", () => {
    const url = new URL(makeClient().getAuthorizationUrl("state-abc"));

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(baseOptions.redirectUri);
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });

  it("exchanges a code for an access token", async () => {
    const client = makeClient([
      {
        method: "post",
        url: GITHUB_TOKEN_URL,
        status: 200,
        data: {
          access_token: "gho_token",
          token_type: "bearer",
          scope: "read:user,user:email",
        },
      },
    ]);

    expect(await client.exchangeCodeForToken("code-1")).toBe("gho_token");
  });

  it("throws when the token exchange returns an error", async () => {
    const client = makeClient([
      {
        method: "post",
        url: GITHUB_TOKEN_URL,
        status: 200,
        data: {
          error: "bad_verification_code",
          error_description: "The code is incorrect or expired.",
        },
      },
    ]);

    await expect(client.exchangeCodeForToken("bad")).rejects.toThrow(
      /bad_verification_code/,
    );
  });

  it("returns the user using the profile email when present", async () => {
    const client = makeClient([
      {
        method: "get",
        url: GITHUB_API_USER_URL,
        status: 200,
        data: {
          id: 99,
          login: "ada",
          name: "Ada",
          email: "ada@public.com",
          avatar_url: "http://img/ada",
        },
      },
    ]);

    const user = await client.getAuthenticatedUser("tok");

    expect(user).toEqual({
      id: "99",
      login: "ada",
      name: "Ada",
      email: "ada@public.com",
      avatarUrl: "http://img/ada",
    });
  });

  it("falls back to the primary verified email when the profile email is null", async () => {
    const client = makeClient([
      {
        method: "get",
        url: GITHUB_API_USER_URL,
        status: 200,
        data: {
          id: 7,
          login: "grace",
          name: null,
          email: null,
          avatar_url: null,
        },
      },
      {
        method: "get",
        url: GITHUB_API_EMAILS_URL,
        status: 200,
        data: [
          { email: "sec@x.com", primary: false, verified: true },
          { email: "grace@x.com", primary: true, verified: true },
        ],
      },
    ]);

    const user = await client.getAuthenticatedUser("tok");

    expect(user.email).toBe("grace@x.com");
  });

  it("throws when there is no verified primary email", async () => {
    const client = makeClient([
      {
        method: "get",
        url: GITHUB_API_USER_URL,
        status: 200,
        data: {
          id: 7,
          login: "grace",
          name: null,
          email: null,
          avatar_url: null,
        },
      },
      {
        method: "get",
        url: GITHUB_API_EMAILS_URL,
        status: 200,
        data: [{ email: "sec@x.com", primary: false, verified: true }],
      },
    ]);

    await expect(client.getAuthenticatedUser("tok")).rejects.toThrow(
      /verified primary email/,
    );
  });
});
