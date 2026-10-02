import { createGitHubOAuthClient } from "./modules/auth/oauth/github-oauth.client.http.js";
import { createAuthService } from "./modules/auth/service/auth.service.js";
import type { AuthService } from "./modules/auth/service/auth.service.types.js";
import { createPostgresInviteRepository } from "./modules/invite/repository/invite.repository.postgres.js";
import { createInviteService } from "./modules/invite/service/invite.service.js";
import type { InviteService } from "./modules/invite/service/invite.service.types.js";
import { createPostgresMusicRepository } from "./modules/music/repository/music.repository.postgres.js";
import { createMusicService } from "./modules/music/service/music.service.js";
import type { MusicService } from "./modules/music/service/music.service.types.js";
import type { PlaylistEvent } from "./modules/playlist/playlist.events.js";
import { createPlaylistResourceMembership } from "./modules/playlist/playlist.resource-membership.js";
import { createPostgresPlaylistRepository } from "./modules/playlist/repository/playlist.repository.postgres.js";
import { createPlaylistService } from "./modules/playlist/service/playlist.service.js";
import type { PlaylistService } from "./modules/playlist/service/playlist.service.types.js";
import { createPostgresRoomRepository } from "./modules/room/repository/room.repository.postgres.js";
import type { RoomEvent } from "./modules/room/room.events.js";
import { createRoomResourceMembership } from "./modules/room/room.resource-membership.js";
import { createRoomService } from "./modules/room/service/room.service.js";
import type { RoomService } from "./modules/room/service/room.service.types.js";
import { createPostgresSessionRepository } from "./modules/sessions/repository/session.repository.postgres.js";
import { createSessionService } from "./modules/sessions/service/session.service.js";
import type { SessionService } from "./modules/sessions/service/session.service.types.js";
import { createPostgresUserRepository } from "./modules/users/user.repository.postgres.js";
import { getDb } from "./shared/db/index.js";
import { env } from "./shared/env.js";
import { createInMemoryEventBus } from "./shared/realtime/event-bus.in-memory.js";
import { createInMemoryRoomRegistry } from "./shared/realtime/room-registry.in-memory.js";
import type { RoomRegistry } from "./shared/realtime/room-registry.js";
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
  inviteService: InviteService;
  roomService: RoomService;
  /**
   * Who is present in which room (ADR 0039). A single instance, shared by
   * every subscription, because presence is one fact about the process. The
   * `EventBus` is deliberately *not* here: each feature owns one typed to its
   * own events, rather than a single bus with a union of everything.
   */
  roomRegistry: RoomRegistry;
}

/**
 * Composition root (ADR 0027): builds the object graph by hand, injecting the
 * production adapters — `db → repositories → services → authService`. Tests wire
 * the same factories with in-memory fakes instead of calling this.
 */
export function createContainer(): Container {
  const db = getDb();

  const roomRegistry = createInMemoryRoomRegistry();

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
  // One bus shared by the service and the membership adapter: a member who
  // joins through an invite must be announced to whoever is already watching.
  const playlistEventBus = createInMemoryEventBus<PlaylistEvent>();
  const playlistService = createPlaylistService({
    playlistRepository,
    musicRepository,
    objectStorage,
    eventBus: playlistEventBus,
  });

  // One membership adapter per invitable resource type (ADR 0040). Rooms will
  // add a key here; the invite module itself does not change.
  const roomEventBus = createInMemoryEventBus<RoomEvent>();
  const roomRepository = createPostgresRoomRepository(db);
  const roomService = createRoomService({
    roomRepository,
    musicRepository,
    objectStorage,
    eventBus: roomEventBus,
    roomRegistry,
  });

  const inviteService = createInviteService({
    inviteRepository: createPostgresInviteRepository(db),
    resourceMembership: {
      PLAYLIST: createPlaylistResourceMembership({
        playlistRepository,
        eventBus: playlistEventBus,
      }),
      // Rooms became invitable by adding this one adapter (ADR 0040/0041).
      ROOM: createRoomResourceMembership({
        roomRepository,
        eventBus: roomEventBus,
      }),
    },
  });

  return {
    authService,
    sessionService,
    objectStorage,
    musicService,
    playlistService,
    inviteService,
    roomService,
    roomRegistry,
  };
}
