import { describe, expect, it } from "vitest";
import { createInMemoryEventBus } from "../../../shared/realtime/event-bus.in-memory.js";
import { createInMemoryObjectStorage } from "../../../shared/storage/object-storage.in-memory.js";
import { createInMemoryMusicRepository } from "../../music/repository/music.repository.in-memory.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import type { PlaylistEvent } from "../playlist.events.js";
import { playlistTopic } from "../playlist.events.js";
import { createInMemoryPlaylistRepository } from "../repository/playlist.repository.in-memory.js";
import {
  MusicNotFoundError,
  PlaylistForbiddenError,
  PlaylistNotFoundError,
} from "./playlist.service.errors.js";
import { createPlaylistService } from "./playlist.service.js";

function setup() {
  const musicRepository = createInMemoryMusicRepository();
  const playlistRepository = createInMemoryPlaylistRepository({
    resolveMusic: (id) => musicRepository.findById(id),
  });
  const objectStorage = createInMemoryObjectStorage();
  const eventBus = createInMemoryEventBus<PlaylistEvent>();
  const service = createPlaylistService({
    playlistRepository,
    musicRepository,
    objectStorage,
    eventBus,
  });
  return { service, playlistRepository, musicRepository, eventBus };
}

/** Collects `count` events from a playlist's topic, then stops listening. */
async function takeEvents(
  eventBus: ReturnType<typeof createInMemoryEventBus<PlaylistEvent>>,
  playlistId: string,
  count: number,
): Promise<PlaylistEvent[]> {
  const received: PlaylistEvent[] = [];
  for await (const event of eventBus.subscribe(playlistTopic(playlistId))) {
    received.push(event);
    if (received.length === count) {
      break;
    }
  }
  return received;
}

async function seedMusic(
  musicRepository: MusicRepository,
  name: string,
): Promise<string> {
  const music = await musicRepository.create({
    name,
    genres: ["pop"],
    objectKey: `musics/${name}.mp3`,
    thumbnailObjectKey: null,
    uploadedBy: "u1",
  });
  return music.id;
}

describe("PlaylistService.createForUser", () => {
  it("creates a playlist and makes the creator its OWNER", async () => {
    const { service, playlistRepository } = setup();

    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });

    expect(playlist.name).toBe("Mix");
    expect(await playlistRepository.getMemberType(playlist.id, "u1")).toBe(
      "OWNER",
    );
  });
});

describe("PlaylistService.listForUser", () => {
  it("returns only the user's playlists", async () => {
    const { service } = setup();
    await service.createForUser({ name: "Mine", ownerId: "u1" });
    await service.createForUser({ name: "Theirs", ownerId: "u2" });

    const mine = await service.listForUser("u1");
    expect(mine.map((p) => p.name)).toEqual(["Mine"]);
  });
});

describe("PlaylistService.addMusic", () => {
  it("lets a member add a track, visible via getWithMusics", async () => {
    const { service, musicRepository } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "A");

    await service.addMusic({
      playlistId: playlist.id,
      musicId,
      requesterId: "u1",
    });

    const { musics } = await service.getWithMusics({
      playlistId: playlist.id,
      requesterId: "u1",
    });
    expect(musics.map((m) => m.name)).toEqual(["A"]);
    expect(musics[0]?.playbackUrl).toContain("musics/A.mp3");
  });

  it("rejects a non-member with PlaylistForbiddenError", async () => {
    const { service, musicRepository } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "A");

    await expect(
      service.addMusic({ playlistId: playlist.id, musicId, requesterId: "u2" }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);
  });

  it("rejects an unknown playlist with PlaylistNotFoundError", async () => {
    const { service, musicRepository } = setup();
    const musicId = await seedMusic(musicRepository, "A");

    await expect(
      service.addMusic({ playlistId: "nope", musicId, requesterId: "u1" }),
    ).rejects.toBeInstanceOf(PlaylistNotFoundError);
  });

  it("rejects an unknown music with MusicNotFoundError", async () => {
    const { service } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });

    await expect(
      service.addMusic({
        playlistId: playlist.id,
        musicId: "nope",
        requesterId: "u1",
      }),
    ).rejects.toBeInstanceOf(MusicNotFoundError);
  });
});

describe("PlaylistService.getWithMusics", () => {
  it("rejects a non-member with PlaylistForbiddenError", async () => {
    const { service } = setup();
    const playlist = await service.createForUser({
      name: "Mix",
      ownerId: "u1",
    });

    await expect(
      service.getWithMusics({ playlistId: playlist.id, requesterId: "u2" }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);
  });

  it("rejects an unknown playlist with PlaylistNotFoundError", async () => {
    const { service } = setup();

    await expect(
      service.getWithMusics({ playlistId: "nope", requesterId: "u1" }),
    ).rejects.toBeInstanceOf(PlaylistNotFoundError);
  });
});

describe("PlaylistService realtime", () => {
  it("announces an added track to the playlist's topic", async () => {
    const { service, musicRepository, eventBus } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "Track");
    const events = takeEvents(eventBus, playlist.id, 1);

    await service.addMusic({
      playlistId: playlist.id,
      musicId,
      requesterId: "u1",
    });

    await expect(events).resolves.toEqual([
      {
        type: "MUSIC_ADDED",
        playlistId: playlist.id,
        musicId,
        actorId: "u1",
      },
    ]);
  });

  it("announces nothing when the track does not exist", async () => {
    const { service, eventBus } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });

    await expect(
      service.addMusic({
        playlistId: playlist.id,
        musicId: "missing",
        requesterId: "u1",
      }),
    ).rejects.toBeInstanceOf(MusicNotFoundError);
    expect(eventBus.subscriberCount(playlistTopic(playlist.id))).toBe(0);
  });

  it("announces nothing when the requester is not a member", async () => {
    const { service, musicRepository, eventBus } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "Track");
    let seen = 0;
    const controller = new AbortController();
    const drained = (async () => {
      for await (const _ of eventBus.subscribe(playlistTopic(playlist.id), {
        signal: controller.signal,
      })) {
        seen += 1;
      }
    })();

    await expect(
      service.addMusic({
        playlistId: playlist.id,
        musicId,
        requesterId: "stranger",
      }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);

    controller.abort();
    await drained;
    expect(seen).toBe(0);
  });

  it("streams a playlist's events to a member", async () => {
    const { service, musicRepository } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });
    const musicId = await seedMusic(musicRepository, "Track");
    const controller = new AbortController();

    const stream = await service.watch({
      playlistId: playlist.id,
      requesterId: "u1",
      signal: controller.signal,
    });
    const first = (async () => {
      for await (const event of stream) {
        return event;
      }
      return null;
    })();

    await service.addMusic({
      playlistId: playlist.id,
      musicId,
      requesterId: "u1",
    });

    expect(await first).toMatchObject({ type: "MUSIC_ADDED", musicId });
    controller.abort();
  });

  it("refuses to stream to a non-member", async () => {
    const { service } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });

    await expect(
      service.watch({ playlistId: playlist.id, requesterId: "stranger" }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);
  });

  it("refuses to stream an unknown playlist", async () => {
    const { service } = setup();

    await expect(
      service.watch({ playlistId: "missing", requesterId: "u1" }),
    ).rejects.toBeInstanceOf(PlaylistNotFoundError);
  });
});

describe("PlaylistService.listMembers", () => {
  it("lists members to a member", async () => {
    const { service, playlistRepository } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });
    await playlistRepository.addMember({
      playlistId: playlist.id,
      userId: "u2",
      type: "MEMBER",
    });

    const members = await service.listMembers({
      playlistId: playlist.id,
      requesterId: "u2",
    });

    expect(members.map((m) => [m.userId, m.type])).toEqual([
      ["u1", "OWNER"],
      ["u2", "MEMBER"],
    ]);
  });

  it("refuses a non-member", async () => {
    const { service } = setup();
    const playlist = await service.createForUser({
      name: "Shared",
      ownerId: "u1",
    });

    await expect(
      service.listMembers({
        playlistId: playlist.id,
        requesterId: "stranger",
      }),
    ).rejects.toBeInstanceOf(PlaylistForbiddenError);
  });
});
