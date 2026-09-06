import { createGitHubOAuthClient } from "./modules/auth/oauth/github-oauth.client.http.js";
import { createAuthService } from "./modules/auth/service/auth.service.js";
import type { AuthService } from "./modules/auth/service/auth.service.types.js";
import { createPostgresMusicRepository } from "./modules/music/repository/music.repository.postgres.js";
import { createMusicService } from "./modules/music/service/music.service.js";
import type { MusicService } from "./modules/music/service/music.service.types.js";
import { createPostgresPlaylistRepository } from "./modules/playlist/repository/playlist.repository.postgres.js";
import { createPlaylistService } from "./modules/playlist/service/playlist.service.js";
import type { PlaylistService } from "./modules/playlist/service/playlist.service.types.js";
import { createPostgresSessionRepository } from "./modules/sessions/repository/session.repository.postgres.js";
import { createSessionService } from "./modules/sessions/service/session.service.js";
import type { SessionService } from "./modules/sessions/service/session.service.types.js";
import { createPostgresUserRepository } from "./modules/users/user.repository.postgres.js";
import { getDb } from "./shared/db/index.js";
import { env } from "./shared/env.js";
import type { ObjectStorage } from "./shared/storage/object-storage.js";
import { createR2ObjectStorage } from "./shared/storage/object-storage.r2.js";

/**
 * The wired application services exposed to the HTTP layer. Kept small — only
 * what controllers need — so the composition root stays the single place that
 * knows the concrete adapters (ADR 0027).
 */
export interface Container {
  authService: AuthService;
  sessionService: SessionService;
  objectStorage: ObjectStorage;
  musicService: MusicService;
  playlistService: PlaylistService;
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

  const objectStorage = createR2ObjectStorage({
    accountId: env.STORAGE_ACCOUNT_ID,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
    bucket: env.STORAGE_BUCKET,
  });

  const musicRepository = createPostgresMusicRepository(db);
  const musicService = createMusicService({ musicRepository, objectStorage });

  const playlistRepository = createPostgresPlaylistRepository(db);
  const playlistService = createPlaylistService({
    playlistRepository,
    musicRepository,
    objectStorage,
  });

  return {
    authService,
    sessionService,
    objectStorage,
    musicService,
    playlistService,
  };
}
