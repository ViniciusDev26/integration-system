import { randomBytes } from "node:crypto";
import { STATE_BYTES } from "./auth.service.constants.js";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "./auth.service.errors.js";
import type { AuthService, AuthServiceOptions } from "./auth.service.types.js";

export function createAuthService(options: AuthServiceOptions): AuthService {
  const { githubClient, userRepository, sessionService, passwordHasher } =
    options;
  const generateState =
    options.generateState ??
    (() => randomBytes(STATE_BYTES).toString("base64url"));

  /**
   * A hash to check against when no account matched, so an unknown address does
   * not answer measurably faster than a wrong password. Computed once, lazily —
   * argon2 is expensive on purpose, and most logins never need this.
   */
  let dummyHash: Promise<string> | null = null;
  function burnTimeLikeAVerification(): Promise<boolean> {
    dummyHash ??= passwordHasher.hash(randomBytes(16).toString("hex"));
    return dummyHash.then((hash) => passwordHasher.verify(hash, "no-match"));
  }

  return {
    getLoginUrl() {
      const state = generateState();
      return { url: githubClient.getAuthorizationUrl(state), state };
    },

    async handleCallback({ code, state, expectedState }) {
      if (expectedState.length === 0 || state !== expectedState) {
        throw new Error("Invalid OAuth state");
      }

      const accessToken = await githubClient.exchangeCodeForToken(code);
      const githubUser = await githubClient.getAuthenticatedUser(accessToken);

      // An account that already carries this GitHub id is the common path.
      const byGithubId = await userRepository.findByGithubId(githubUser.id);
      if (byGithubId === null) {
        // Otherwise the address may already belong to a password account. GitHub
        // only hands over verified addresses, so it has proved ownership and the
        // identity can be attached (ADR 0043). The reverse direction — setting a
        // password on an existing account — proves nothing and is refused.
        const byEmail = await userRepository.findByEmail(githubUser.email);
        if (byEmail !== null) {
          const linked = await userRepository.linkGithub({
            userId: byEmail.id,
            githubId: githubUser.id,
            name: githubUser.name,
            imageUrl: githubUser.avatarUrl,
          });
          return sessionService.createForUser(linked.id);
        }
      }

      const user = await userRepository.upsertByGithubId({
        githubId: githubUser.id,
        name: githubUser.name,
        email: githubUser.email,
        imageUrl: githubUser.avatarUrl,
      });

      return sessionService.createForUser(user.id);
    },

    async register({ email, password, name }) {
      if ((await userRepository.findByEmail(email)) !== null) {
        throw new EmailAlreadyRegisteredError(email);
      }

      const user = await userRepository.createWithPassword({
        email,
        name,
        passwordHash: await passwordHasher.hash(password),
      });

      return sessionService.createForUser(user.id);
    },

    async loginWithPassword({ email, password }) {
      const user = await userRepository.findByEmail(email);

      // Same error and comparable cost whether the account is unknown or simply
      // has no password — an OAuth-only account must not be distinguishable.
      if (user === null || user.passwordHash === null) {
        await burnTimeLikeAVerification();
        throw new InvalidCredentialsError(email);
      }

      if (!(await passwordHasher.verify(user.passwordHash, password))) {
        throw new InvalidCredentialsError(email);
      }

      return sessionService.createForUser(user.id);
    },

    async getCurrentUser(sessionId) {
      const session = await sessionService.validate(sessionId);
      if (session === null) {
        return null;
      }
      return userRepository.findById(session.userId);
    },
  };
}
