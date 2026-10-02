import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryEventBus } from "../../../shared/realtime/event-bus.in-memory.js";
import { createInMemoryRoomRegistry } from "../../../shared/realtime/room-registry.in-memory.js";
import { createInMemoryObjectStorage } from "../../../shared/storage/object-storage.in-memory.js";
import { createInMemoryMusicRepository } from "../../music/repository/music.repository.in-memory.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import { createInMemoryRoomRepository } from "../repository/room.repository.in-memory.js";
import type { RoomEvent } from "../room.events.js";
import { roomTopic } from "../room.events.js";
import {
  RoomForbiddenError,
  RoomMusicNotFoundError,
  RoomNotFoundError,
} from "./room.service.errors.js";
import { createRoomService } from "./room.service.js";
import type { RoomService } from "./room.service.types.js";

const OWNER = "user-owner";
const GUEST = "user-guest";
const T0 = new Date("2026-10-02T12:00:00.000Z");

function setup() {
  const musicRepository = createInMemoryMusicRepository();
  const roomRepository = createInMemoryRoomRepository({
    resolveMusic: (id) => musicRepository.findById(id),
  });
  const eventBus = createInMemoryEventBus<RoomEvent>();
  const roomRegistry = createInMemoryRoomRegistry();
  let clock = T0;
  const service = createRoomService({
    roomRepository,
    musicRepository,
    objectStorage: createInMemoryObjectStorage(),
    eventBus,
    roomRegistry,
    now: () => clock,
  });
  return {
    service,
    roomRepository,
    musicRepository,
    eventBus,
    roomRegistry,
    advance: (ms: number) => {
      clock = new Date(clock.getTime() + ms);
    },
  };
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
    uploadedBy: OWNER,
  });
  return music.id;
}

/** Collects `count` events from a room's topic, then stops listening. */
async function takeEvents(
  eventBus: ReturnType<typeof createInMemoryEventBus<RoomEvent>>,
  roomId: string,
  count: number,
): Promise<RoomEvent[]> {
  const received: RoomEvent[] = [];
  for await (const event of eventBus.subscribe(roomTopic(roomId))) {
    received.push(event);
    if (received.length === count) {
      break;
    }
  }
  return received;
}

describe("RoomService", () => {
  let ctx: ReturnType<typeof setup>;
  let service: RoomService;

  beforeEach(() => {
    ctx = setup();
    service = ctx.service;
  });

  async function ownedRoom() {
    return service.createForUser({ name: "Friday", ownerId: OWNER });
  }

  describe("membership", () => {
    it("makes the creator a member, and lists the room for them", async () => {
      const room = await ownedRoom();

      expect((await service.listForUser(OWNER)).map((r) => r.id)).toEqual([
        room.id,
      ]);
      expect(await service.listForUser(GUEST)).toEqual([]);
    });

    it("refuses every room-scoped read to a non-member", async () => {
      const room = await ownedRoom();
      const input = { roomId: room.id, requesterId: GUEST };

      await expect(service.get(input)).rejects.toBeInstanceOf(
        RoomForbiddenError,
      );
      await expect(service.listMembers(input)).rejects.toBeInstanceOf(
        RoomForbiddenError,
      );
      await expect(service.watch(input)).rejects.toBeInstanceOf(
        RoomForbiddenError,
      );
    });

    it("reports an unknown room as not found", async () => {
      await expect(
        service.get({ roomId: "nope", requesterId: OWNER }),
      ).rejects.toBeInstanceOf(RoomNotFoundError);
    });
  });

  describe("queueMusic", () => {
    it("queues a track and announces it", async () => {
      const room = await ownedRoom();
      const musicId = await seedMusic(ctx.musicRepository, "track");
      const events = takeEvents(ctx.eventBus, room.id, 1);

      await service.queueMusic({
        roomId: room.id,
        musicId,
        requesterId: OWNER,
      });

      await expect(events).resolves.toEqual([
        { type: "MUSIC_QUEUED", roomId: room.id, musicId, actorId: OWNER },
      ]);
      const snapshot = await service.get({
        roomId: room.id,
        requesterId: OWNER,
      });
      expect(snapshot.musics.map((m) => m.id)).toEqual([musicId]);
    });

    it("refuses a track that does not exist", async () => {
      const room = await ownedRoom();

      await expect(
        service.queueMusic({
          roomId: room.id,
          musicId: "missing",
          requesterId: OWNER,
        }),
      ).rejects.toBeInstanceOf(RoomMusicNotFoundError);
    });
  });

  describe("commandPlayback", () => {
    async function roomWithTrack() {
      const room = await ownedRoom();
      const musicId = await seedMusic(ctx.musicRepository, "track");
      await service.queueMusic({
        roomId: room.id,
        musicId,
        requesterId: OWNER,
      });
      return { room, musicId };
    }

    it("starts a queued track and persists the anchor", async () => {
      const { room, musicId } = await roomWithTrack();

      const updated = await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "SELECT_TRACK", musicId },
      });

      expect(updated.currentMusicId).toBe(musicId);
      expect(updated.isPlaying).toBe(true);
      expect(updated.positionMs).toBe(0);
      expect(updated.playbackUpdatedAt).toEqual(T0);
    });

    it("refuses a track that is not queued in this room", async () => {
      const { room } = await roomWithTrack();
      const elsewhere = await seedMusic(ctx.musicRepository, "elsewhere");

      await expect(
        service.commandPlayback({
          roomId: room.id,
          requesterId: OWNER,
          command: { type: "SELECT_TRACK", musicId: elsewhere },
        }),
      ).rejects.toBeInstanceOf(RoomMusicNotFoundError);
    });

    it("pauses at the position reached since the anchor", async () => {
      const { room, musicId } = await roomWithTrack();
      await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "SELECT_TRACK", musicId },
      });

      ctx.advance(30_000);
      const paused = await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "PAUSE" },
      });

      expect(paused.isPlaying).toBe(false);
      expect(paused.positionMs).toBe(30_000);
    });

    it("announces the anchor and the server's clock", async () => {
      const { room, musicId } = await roomWithTrack();
      const events = takeEvents(ctx.eventBus, room.id, 1);

      await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "SELECT_TRACK", musicId },
      });

      const [event] = await events;
      expect(event).toMatchObject({
        type: "PLAYBACK_CHANGED",
        roomId: room.id,
        actorId: OWNER,
        serverNow: T0,
      });
    });

    it("lets any member drive, not only the owner", async () => {
      const { room, musicId } = await roomWithTrack();
      await ctx.roomRepository.addMember({
        roomId: room.id,
        userId: GUEST,
        type: "MEMBER",
      });

      await expect(
        service.commandPlayback({
          roomId: room.id,
          requesterId: GUEST,
          command: { type: "SELECT_TRACK", musicId },
        }),
      ).resolves.toMatchObject({ isPlaying: true });
    });
  });

  describe("presence", () => {
    it("marks a watcher present and tells them so", async () => {
      const room = await ownedRoom();
      const controller = new AbortController();

      const stream = await service.watch({
        roomId: room.id,
        requesterId: OWNER,
        signal: controller.signal,
      });
      const first = (async () => {
        for await (const event of stream) {
          return event;
        }
        return null;
      })();

      expect(await first).toEqual({
        type: "PRESENCE_CHANGED",
        roomId: room.id,
        present: [OWNER],
      });
      controller.abort();
    });

    it("removes the watcher when the stream ends", async () => {
      const room = await ownedRoom();
      const controller = new AbortController();
      const stream = await service.watch({
        roomId: room.id,
        requesterId: OWNER,
        signal: controller.signal,
      });

      const drained = (async () => {
        for await (const _ of stream) {
          // drain
        }
      })();
      await new Promise((resolve) => setImmediate(resolve));
      expect(ctx.roomRegistry.members(room.id)).toEqual([OWNER]);

      controller.abort();
      await drained;

      expect(ctx.roomRegistry.members(room.id)).toEqual([]);
    });

    it("reports presence in the snapshot, separately from membership", async () => {
      const room = await ownedRoom();
      await ctx.roomRepository.addMember({
        roomId: room.id,
        userId: GUEST,
        type: "MEMBER",
      });

      const before = await service.get({
        roomId: room.id,
        requesterId: OWNER,
      });
      expect(before.present).toEqual([]);
      expect(
        await service.listMembers({ roomId: room.id, requesterId: OWNER }),
      ).toHaveLength(2);

      const controller = new AbortController();
      const stream = await service.watch({
        roomId: room.id,
        requesterId: GUEST,
        signal: controller.signal,
      });
      void (async () => {
        for await (const _ of stream) {
          // keep the subscription open
        }
      })();
      await new Promise((resolve) => setImmediate(resolve));

      const during = await service.get({ roomId: room.id, requesterId: OWNER });
      expect(during.present).toEqual([GUEST]);
      controller.abort();
    });
  });
});
