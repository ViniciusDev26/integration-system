import { describe, expect, it } from "vitest";
import { createInMemorySessionRepository } from "../../sessions/repository/session.repository.in-memory.js";
import { createSessionService } from "../../sessions/service/session.service.js";
import { createInMemoryUserRepository } from "../../users/user.repository.in-memory.js";
import { createFakeGitHubOAuthClient } from "../oauth/github-oauth.client.fake.js";
import { createFakePasswordHasher } from "../password/password-hasher.fake.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "./auth.service.errors.js";
import { createAuthService } from "./auth.service.js";

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
    passwordHasher: createFakePasswordHasher(),
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

describe("AuthService — email/password (ADR 0043)", () => {
  it("registers an account and signs it in", async () => {
    const { service, userRepository } = setup();

    const session = await service.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    const user = await userRepository.findByEmail("grace@example.com");
    expect(user).not.toBeNull();
    expect(session.userId).toBe(user?.id);
    // The password is never stored as typed.
    expect(user?.passwordHash).not.toBe("hunter2-hunter2");
    expect(user?.githubId).toBeNull();
  });

  it("refuses to register an address that already has an account", async () => {
    const { service } = setup();
    await service.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    await expect(
      service.register({
        email: "grace@example.com",
        password: "another-password",
        name: "Impostor",
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyRegisteredError);
  });

  it("signs in with the right password", async () => {
    const { service, userRepository } = setup();
    await service.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    const session = await service.loginWithPassword({
      email: "grace@example.com",
      password: "hunter2-hunter2",
    });

    expect(session.userId).toBe(
      (await userRepository.findByEmail("grace@example.com"))?.id,
    );
  });

  it("gives the same error for a wrong password and an unknown address", async () => {
    const { service } = setup();
    await service.register({
      email: "grace@example.com",
      password: "hunter2-hunter2",
      name: "Grace",
    });

    await expect(
      service.loginWithPassword({
        email: "grace@example.com",
        password: "wrong-password",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
    await expect(
      service.loginWithPassword({
        email: "nobody@example.com",
        password: "hunter2-hunter2",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it("refuses a password login against an OAuth-only account, indistinguishably", async () => {
    const { service } = setup();
    // Signing in with GitHub creates an account with no password.
    await service.handleCallback({
      code: "good-code",
      state: "state-xyz",
      expectedState: "state-xyz",
    });

    await expect(
      service.loginWithPassword({
        email: githubUser.email,
        password: "anything-at-all",
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });
});

describe("AuthService — linking the two routes (ADR 0043)", () => {
  it("attaches GitHub to an existing password account with the same email", async () => {
    const { service, userRepository } = setup();
    const registered = await service.register({
      email: githubUser.email,
      password: "hunter2-hunter2",
      name: "Grace",
    });

    const session = await service.handleCallback({
      code: "good-code",
      state: "state-xyz",
      expectedState: "state-xyz",
    });

    // Same account, not a second one.
    expect(session.userId).toBe(registered.userId);
    const user = await userRepository.findById(registered.userId);
    expect(user?.githubId).toBe(githubUser.id);
    // And the password still works afterwards.
    await expect(
      service.loginWithPassword({
        email: githubUser.email,
        password: "hunter2-hunter2",
      }),
    ).resolves.toMatchObject({ userId: registered.userId });
  });

  it("keeps the name chosen at registration when linking", async () => {
    const { service, userRepository } = setup();
    const registered = await service.register({
      email: githubUser.email,
      password: "hunter2-hunter2",
      name: "Grace",
    });

    await service.handleCallback({
      code: "good-code",
      state: "state-xyz",
      expectedState: "state-xyz",
    });

    expect((await userRepository.findById(registered.userId))?.name).toBe(
      "Grace",
    );
  });

  it("signing in with GitHub twice does not create a second account", async () => {
    const { service, userRepository } = setup();

    const first = await service.handleCallback({
      code: "good-code",
      state: "state-xyz",
      expectedState: "state-xyz",
    });
    const second = await service.handleCallback({
      code: "good-code",
      state: "state-xyz",
      expectedState: "state-xyz",
    });

    expect(second.userId).toBe(first.userId);
    expect(await userRepository.findByEmail(githubUser.email)).not.toBeNull();
  });
});
