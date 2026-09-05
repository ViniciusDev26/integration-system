import { createAuthService } from "./modules/auth/auth.service.js";
import type { AuthService } from "./modules/auth/auth.service.types.js";
import { createGitHubOAuthClient } from "./modules/auth/github-oauth.client.http.js";
import { createPostgresSessionRepository } from "./modules/sessions/session.repository.postgres.js";
import { createSessionService } from "./modules/sessions/session.service.js";
import type { SessionService } from "./modules/sessions/session.service.types.js";
import { createPostgresUserRepository } from "./modules/users/user.repository.postgres.js";
import { getDb } from "./shared/db/index.js";
import { env } from "./shared/env.js";

/**
 * The wired application services exposed to the HTTP layer. Kept small — only
 * what controllers need — so the composition root stays the single place that
 * knows the concrete adapters (ADR 0027).
 */
export interface Container {
  authService: AuthService;
  sessionService: SessionService;
}

/**
 * Composition root (ADR 0027): builds the object graph by hand, injecting the
 * production adapters — `db → repositories → services → authService`. Tests wire
 * the same factories with in-memory fakes instead of calling this.
 */
export function createContainer(): Container {
  const db = getDb();

  const userRepository = createPostgresUserRepository(db);
  const sessionRepository = createPostgresSessionRepository(db);

  const sessionService = createSessionService({ sessionRepository });

  const githubClient = createGitHubOAuthClient({
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    redirectUri: `${env.PUBLIC_BASE_URL}/auth/github/callback`,
  });

  const authService = createAuthService({
    githubClient,
    userRepository,
    sessionService,
  });

  return { authService, sessionService };
}
