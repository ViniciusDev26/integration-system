import { describe, expect, it } from "vitest";
import { createInMemorySessionRepository } from "../sessions/session.repository.in-memory.js";
import { createSessionService } from "../sessions/session.service.js";
import { createInMemoryUserRepository } from "../users/user.repository.in-memory.js";
import { createAuthService } from "./auth.service.js";
import { createFakeGitHubOAuthClient } from "./github-oauth.client.fake.js";

const githubUser = {
  id: "gh-1",
  login: "ada",
  name: "Ada",
  email: "ada@x.com",
  avatarUrl: "http://img/ada",
};

function setup() {
  const githubClient = createFakeGitHubOAuthClient({
    tokensByCode: { "good-code": "access-1" },
    usersByToken: { "access-1": githubUser },
  });
  const userRepository = createInMemoryUserRepository();
  const sessionService = createSessionService({
    sessionRepository: createInMemorySessionRepository(),
  });
  const service = createAuthService({
    githubClient,
    userRepository,
    sessionService,
    generateState: () => "state-xyz",
  });
  return { service, userRepository, sessionService };
}

describe("AuthService", () => {
  it("getLoginUrl returns the authorization url carrying the generated state", () => {
    const { service } = setup();

    const { url, state } = service.getLoginUrl();

    expect(state).toBe("state-xyz");
    expect(new URL(url).searchParams.get("state")).toBe("state-xyz");
  });

  it("handleCallback upserts the user and creates a session for them", async () => {
    const { service, userRepository } = setup();

    const session = await service.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });

    const user = await userRepository.findByGithubId("gh-1");
    expect(user).not.toBeNull();
    expect(session.userId).toBe(user?.id);
    expect(session.id).toBeTruthy();
  });

  it("maps GitHub fields onto the user (email, name, avatar -> imageUrl)", async () => {
    const { service, userRepository } = setup();

    await service.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });

    const user = await userRepository.findByGithubId("gh-1");
    expect(user?.email).toBe("ada@x.com");
    expect(user?.name).toBe("Ada");
    expect(user?.imageUrl).toBe("http://img/ada");
  });

  it("throws on state mismatch (CSRF protection)", async () => {
    const { service } = setup();

    await expect(
      service.handleCallback({
        code: "good-code",
        state: "attacker",
        expectedState: "victim",
      }),
    ).rejects.toThrow(/state/i);
  });

  it("does not create a duplicate user on repeated login (same github id)", async () => {
    const { service, userRepository } = setup();

    const first = await service.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });
    const second = await service.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });

    const user = await userRepository.findByGithubId("gh-1");
    expect(first.userId).toBe(user?.id);
    expect(second.userId).toBe(user?.id);
    expect(first.id).not.toBe(second.id);
  });

  it("getCurrentUser resolves the user behind a valid session id", async () => {
    const { service } = setup();
    const session = await service.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });

    const user = await service.getCurrentUser(session.id);

    expect(user?.githubId).toBe("gh-1");
    expect(user?.email).toBe("ada@x.com");
  });

  it("getCurrentUser returns null for an unknown session id", async () => {
    const { service } = setup();

    expect(await service.getCurrentUser("nope")).toBeNull();
  });

  it("getCurrentUser returns null once the session is revoked", async () => {
    const { service, sessionService } = setup();
    const session = await service.handleCallback({
      code: "good-code",
      state: "s",
      expectedState: "s",
    });

    await sessionService.revoke(session.id);

    expect(await service.getCurrentUser(session.id)).toBeNull();
  });
});
