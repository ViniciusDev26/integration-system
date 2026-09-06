import { randomBytes } from "node:crypto";
import { STATE_BYTES } from "./auth.service.constants.js";
import type { AuthService, AuthServiceOptions } from "./auth.service.types.js";

export function createAuthService(options: AuthServiceOptions): AuthService {
  const { githubClient, userRepository, sessionService } = options;
  const generateState =
    options.generateState ??
    (() => randomBytes(STATE_BYTES).toString("base64url"));

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

      const user = await userRepository.upsertByGithubId({
        githubId: githubUser.id,
        name: githubUser.name,
        email: githubUser.email,
        imageUrl: githubUser.avatarUrl,
      });

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
