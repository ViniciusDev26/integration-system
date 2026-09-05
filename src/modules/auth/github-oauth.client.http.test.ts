import { describe, expect, it } from "vitest";
import { createGitHubOAuthClient } from "./github-oauth.client.http.js";

const baseOptions = {
  clientId: "client-123",
  clientSecret: "secret-xyz",
  redirectUri: "http://localhost:3000/auth/github/callback",
};

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("GitHubOAuthClient (http)", () => {
  it("builds an authorization URL with client_id, redirect_uri, scope, state", () => {
    const client = createGitHubOAuthClient({
      ...baseOptions,
      scopes: ["read:user", "user:email"],
      fetch: async () => new Response(),
    });

    const url = new URL(client.getAuthorizationUrl("state-abc"));

    expect(url.origin + url.pathname).toBe(
      "https://github.com/login/oauth/authorize",
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(baseOptions.redirectUri);
    expect(url.searchParams.get("scope")).toBe("read:user user:email");
    expect(url.searchParams.get("state")).toBe("state-abc");
  });

  it("exchanges a code for an access token", async () => {
    const fetch: typeof globalThis.fetch = async (input) => {
      expect(String(input)).toBe("https://github.com/login/oauth/access_token");
      return jsonResponse({
        access_token: "gho_token",
        token_type: "bearer",
        scope: "read:user,user:email",
      });
    };
    const client = createGitHubOAuthClient({ ...baseOptions, fetch });

    expect(await client.exchangeCodeForToken("code-1")).toBe("gho_token");
  });

  it("throws when the token exchange returns an error", async () => {
    const fetch: typeof globalThis.fetch = async () =>
      jsonResponse({
        error: "bad_verification_code",
        error_description: "The code is incorrect or expired.",
      });
    const client = createGitHubOAuthClient({ ...baseOptions, fetch });

    await expect(client.exchangeCodeForToken("bad")).rejects.toThrow(
      /bad_verification_code/,
    );
  });

  it("returns the user using the profile email when present", async () => {
    const fetch: typeof globalThis.fetch = async (input) => {
      if (String(input) === "https://api.github.com/user") {
        return jsonResponse({
          id: 99,
          login: "ada",
          name: "Ada",
          email: "ada@public.com",
          avatar_url: "http://img/ada",
        });
      }
      throw new Error(`unexpected url ${String(input)}`);
    };
    const client = createGitHubOAuthClient({ ...baseOptions, fetch });

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
    const fetch: typeof globalThis.fetch = async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/user") {
        return jsonResponse({
          id: 7,
          login: "grace",
          name: null,
          email: null,
          avatar_url: null,
        });
      }
      if (url === "https://api.github.com/user/emails") {
        return jsonResponse([
          { email: "sec@x.com", primary: false, verified: true },
          { email: "grace@x.com", primary: true, verified: true },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    };
    const client = createGitHubOAuthClient({ ...baseOptions, fetch });

    const user = await client.getAuthenticatedUser("tok");

    expect(user.email).toBe("grace@x.com");
  });

  it("throws when there is no verified primary email", async () => {
    const fetch: typeof globalThis.fetch = async (input) => {
      const url = String(input);
      if (url === "https://api.github.com/user") {
        return jsonResponse({
          id: 7,
          login: "grace",
          name: null,
          email: null,
          avatar_url: null,
        });
      }
      if (url === "https://api.github.com/user/emails") {
        return jsonResponse([
          { email: "sec@x.com", primary: false, verified: true },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    };
    const client = createGitHubOAuthClient({ ...baseOptions, fetch });

    await expect(client.getAuthenticatedUser("tok")).rejects.toThrow(
      /verified primary email/,
    );
  });
});
