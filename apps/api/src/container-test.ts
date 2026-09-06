import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Container } from "./container.js";
import type { FakeGitHubOAuthClientOptions } from "./modules/auth/oauth/github-oauth.client.fake.js";
import { createFakeGitHubOAuthClient } from "./modules/auth/oauth/github-oauth.client.fake.js";
import type { GitHubOAuthClient } from "./modules/auth/oauth/github-oauth.client.js";
import { createAuthService } from "./modules/auth/service/auth.service.js";
import { createInMemoryMusicRepository } from "./modules/music/repository/music.repository.in-memory.js";
import type { MusicRepository } from "./modules/music/repository/music.repository.js";
import { createMusicService } from "./modules/music/service/music.service.js";
import { createInMemoryPlaylistRepository } from "./modules/playlist/repository/playlist.repository.in-memory.js";
import type { PlaylistRepository } from "./modules/playlist/repository/playlist.repository.js";
import { createPlaylistService } from "./modules/playlist/service/playlist.service.js";
import { createInMemorySessionRepository } from "./modules/sessions/repository/session.repository.in-memory.js";
import { createSessionService } from "./modules/sessions/service/session.service.js";
import { createInMemoryUserRepository } from "./modules/users/user.repository.in-memory.js";
import type { UserRepository } from "./modules/users/user.repository.js";
import type { Database } from "./shared/db/database.js";
import * as schema from "./shared/db/schema/index.js";
import type { InMemoryObjectStorage } from "./shared/storage/object-storage.in-memory.js";
import { createInMemoryObjectStorage } from "./shared/storage/object-storage.in-memory.js";

/**
 * Test-side composition root — the counterpart to `src/container.ts`. Where the
 * production root wires real adapters (Postgres, R2, real GitHub), this wires the
 * in-memory fakes used by unit/controller tests, and (below) bootstraps a real
 * disposable Postgres for repository integration tests. Excluded from the build
 * (see `tsconfig.build.json`); it replaces the former `src/test-support/`.
 */

export interface TestContainerOptions {
  /** Seed data / URL for the fake GitHub OAuth client. */
  github?: FakeGitHubOAuthClientOptions;
  /** Deterministic CSRF state for the auth service (defaults to random). */
  generateState?: () => string;
}

/**
 * The production {@link Container} plus the underlying fakes, exposed so tests can
 * seed data (`userRepository`) and assert side effects (`objectStorage`).
 */
export interface TestContainer extends Container {
  objectStorage: InMemoryObjectStorage;
  userRepository: UserRepository;
  musicRepository: MusicRepository;
  playlistRepository: PlaylistRepository;
  githubClient: GitHubOAuthClient;
}

/** Builds the service graph from in-memory fakes (ADR 0027). */
export function createTestContainer(
  options: TestContainerOptions = {},
): TestContainer {
  const userRepository = createInMemoryUserRepository();
  const sessionRepository = createInMemorySessionRepository();

  const sessionService = createSessionService({ sessionRepository });
  const githubClient = createFakeGitHubOAuthClient(options.github);
  const authService = createAuthService({
    githubClient,
    userRepository,
    sessionService,
    generateState: options.generateState,
  });
  const objectStorage = createInMemoryObjectStorage();
  const musicRepository = createInMemoryMusicRepository();
  const musicService = createMusicService({ musicRepository, objectStorage });

  const playlistRepository = createInMemoryPlaylistRepository({
    resolveMusic: (id) => musicRepository.findById(id),
  });
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
    userRepository,
    musicRepository,
    playlistRepository,
    githubClient,
  };
}

export interface TestDatabase {
  db: Database;
  stop: () => Promise<void>;
}

/**
 * Spin up a disposable PostgreSQL 18 container, apply the real Drizzle
 * migrations, and return a Drizzle handle for repository integration tests
 * (ADR 0015). The Postgres version matches Compose (ADR 0021). Testcontainers is
 * imported dynamically so unit tests that only need {@link createTestContainer}
 * don't load it.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const { PostgreSqlContainer } = await import("@testcontainers/postgresql");

  // Testcontainers may resolve the Docker host to the bridge gateway
  // (e.g. 172.17.0.1), which is unreachable on some setups (notably WSL2),
  // making container/Reaper connections hang. Published ports ARE reachable via
  // localhost, so default the host to localhost unless the environment already
  // provides one (e.g. CI / docker-in-docker).
  process.env.TESTCONTAINERS_HOST_OVERRIDE ??= "localhost";

  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    "postgres:18-alpine",
  ).start();

  const client = postgres(container.getConnectionUri(), { max: 1 });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "drizzle" });

  return {
    db,
    stop: async () => {
      await client.end();
      await container.stop();
    },
  };
}
