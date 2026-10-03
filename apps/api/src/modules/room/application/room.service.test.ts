import { beforeEach, describe, expect, it } from "vitest";
import { createInMemoryEventBus } from "../../../shared/realtime/event-bus.in-memory.js";
import { createInMemoryRoomRegistry } from "../../../shared/realtime/room-registry.in-memory.js";
import { createInMemoryMusicRepository } from "../../music/repository/music.repository.in-memory.js";
import type { MusicRepository } from "../../music/repository/music.repository.js";
import { createInMemoryRoomRepository } from "../repository/room.repository.in-memory.js";
import { createInMemoryRoomMessageRepository } from "../repository/room-message.repository.in-memory.js";
import type {
  RoomMessageRepository,
  RoomMessageSummary,
} from "../repository/room-message.repository.js";
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
  const chatEventBus = createInMemoryEventBus<RoomMessageSummary>();
  const roomRegistry = createInMemoryRoomRegistry();
  const baseMessages = createInMemoryRoomMessageRepository();
  /** Lets a test hold `listAfter` open, to reproduce the backfill race. */
  let pauseListAfter: Promise<void> | null = null;
  const roomMessageRepository: RoomMessageRepository = {
    create: (input) => baseMessages.create(input),
    listRecent: (roomId, limit) => baseMessages.listRecent(roomId, limit),
    listAfter: async (input) => {
      if (pauseListAfter !== null) {
        await pauseListAfter;
      }
      return baseMessages.listAfter(input);
    },
  };
  let clock = T0;
  const service = createRoomService({
    roomRepository,
    roomMessageRepository,
    musicRepository,
    eventBus,
    chatEventBus,
    roomRegistry,
    now: () => clock,
  });
  return {
    service,
    roomRepository,
    roomMessageRepository,
    musicRepository,
    eventBus,
    chatEventBus,
    roomRegistry,
    holdBackfill: (gate: Promise<void>) => {
      pauseListAfter = gate;
    },
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

  describe("reportTrackEnded", () => {
    async function playingRoom(trackNames: string[]) {
      const room = await ownedRoom();
      const ids: string[] = [];
      for (const name of trackNames) {
        const musicId = await seedMusic(ctx.musicRepository, name);
        await service.queueMusic({
          roomId: room.id,
          musicId,
          requesterId: OWNER,
        });
        ids.push(musicId);
      }
      const first = ids[0] ?? "";
      await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "SELECT_TRACK", musicId: first },
      });
      return { room, ids };
    }

    it("advances to the next queued track and announces it", async () => {
      const { room, ids } = await playingRoom(["one", "two"]);
      const events = takeEvents(ctx.eventBus, room.id, 1);
      ctx.advance(206_000);

      const updated = await service.reportTrackEnded({
        roomId: room.id,
        requesterId: OWNER,
        musicId: ids[0] ?? "",
      });

      expect(updated?.currentMusicId).toBe(ids[1]);
      expect(updated?.isPlaying).toBe(true);
      expect(updated?.positionMs).toBe(0);
      const [event] = await events;
      expect(event).toMatchObject({
        type: "PLAYBACK_CHANGED",
        actorId: OWNER,
        anchor: { currentMusicId: ids[1], isPlaying: true },
      });
    });

    it("advances exactly once when every listener reports together", async () => {
      // This is the race the feature exists to resolve: N listeners reach the
      // end at the same moment and all report it.
      const { room, ids } = await playingRoom(["one", "two", "three"]);
      await ctx.roomRepository.addMember({
        roomId: room.id,
        userId: GUEST,
        type: "MEMBER",
      });

      const reports = await Promise.all([
        service.reportTrackEnded({
          roomId: room.id,
          requesterId: OWNER,
          musicId: ids[0] ?? "",
        }),
        service.reportTrackEnded({
          roomId: room.id,
          requesterId: GUEST,
          musicId: ids[0] ?? "",
        }),
      ]);

      expect(reports.filter((r) => r !== null)).toHaveLength(1);
      const room_ = await ctx.roomRepository.findById(room.id);
      expect(room_?.currentMusicId).toBe(ids[1]);
    });

    it("stops at the end of the queue instead of wrapping", async () => {
      const { room, ids } = await playingRoom(["only"]);

      const updated = await service.reportTrackEnded({
        roomId: room.id,
        requesterId: OWNER,
        musicId: ids[0] ?? "",
      });

      expect(updated?.isPlaying).toBe(false);
      expect(updated?.currentMusicId).toBe(ids[0]);
    });

    it("ignores a report for a track the room has already left", async () => {
      const { room, ids } = await playingRoom(["one", "two"]);
      await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "SELECT_TRACK", musicId: ids[1] ?? "" },
      });
      const events = takeEvents(ctx.eventBus, room.id, 1);

      const updated = await service.reportTrackEnded({
        roomId: room.id,
        requesterId: OWNER,
        musicId: ids[0] ?? "",
      });
      expect(updated).toBeNull();

      // Nothing was published: the next event on the topic is the one this
      // test puts there deliberately, not an advance from the stale report.
      await service.commandPlayback({
        roomId: room.id,
        requesterId: OWNER,
        command: { type: "PAUSE" },
      });
      const [event] = await events;
      expect(event).toMatchObject({
        type: "PLAYBACK_CHANGED",
        anchor: { isPlaying: false },
      });
    });

    it("refuses a report from someone who is not in the room", async () => {
      const { room, ids } = await playingRoom(["one", "two"]);

      await expect(
        service.reportTrackEnded({
          roomId: room.id,
          requesterId: GUEST,
          musicId: ids[0] ?? "",
        }),
      ).rejects.toBeInstanceOf(RoomForbiddenError);
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

describe("RoomService chat (ADR 0044)", () => {
  let ctx: ReturnType<typeof setup>;
  let service: RoomService;

  beforeEach(() => {
    ctx = setup();
    service = ctx.service;
  });

  async function roomWithGuest() {
    const room = await service.createForUser({
      name: "Friday",
      ownerId: OWNER,
    });
    await ctx.roomRepository.addMember({
      roomId: room.id,
      userId: GUEST,
      type: "MEMBER",
    });
    return room;
  }

  /** Reads `count` messages from a stream, then stops. */
  async function take(
    stream: AsyncIterable<RoomMessageSummary>,
    count: number,
  ): Promise<string[]> {
    const bodies: string[] = [];
    for await (const message of stream) {
      bodies.push(message.body);
      if (bodies.length === count) {
        break;
      }
    }
    return bodies;
  }

  it("stores a message and hands it back with the author", async () => {
    const room = await roomWithGuest();

    const message = await service.sendMessage({
      roomId: room.id,
      requesterId: GUEST,
      body: "hello room",
    });

    expect(message.body).toBe("hello room");
    expect(message.userId).toBe(GUEST);
  });

  it("refuses to send or read for a non-member", async () => {
    const room = await roomWithGuest();
    const input = { roomId: room.id, requesterId: "stranger" };

    await expect(
      service.sendMessage({ ...input, body: "let me in" }),
    ).rejects.toBeInstanceOf(RoomForbiddenError);
    await expect(service.listMessages(input)).rejects.toBeInstanceOf(
      RoomForbiddenError,
    );
    await expect(service.watchMessages(input)).rejects.toBeInstanceOf(
      RoomForbiddenError,
    );
  });

  it("returns history oldest first", async () => {
    const room = await roomWithGuest();
    for (const body of ["one", "two", "three"]) {
      await service.sendMessage({
        roomId: room.id,
        requesterId: OWNER,
        body,
      });
    }

    const history = await service.listMessages({
      roomId: room.id,
      requesterId: GUEST,
    });

    expect(history.map((m) => m.body)).toEqual(["one", "two", "three"]);
  });

  it("streams live messages when there is no cursor", async () => {
    const room = await roomWithGuest();
    const stream = await service.watchMessages({
      roomId: room.id,
      requesterId: GUEST,
    });
    const received = take(stream, 1);

    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "live one",
    });

    await expect(received).resolves.toEqual(["live one"]);
  });

  it("replays what was missed, then continues live", async () => {
    const room = await roomWithGuest();
    const seen = await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "already seen",
    });
    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "missed while away",
    });

    const stream = await service.watchMessages({
      roomId: room.id,
      requesterId: GUEST,
      lastEventId: seen.id,
    });
    const received = take(stream, 2);

    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "after reconnect",
    });

    // The one already seen is not repeated.
    await expect(received).resolves.toEqual([
      "missed while away",
      "after reconnect",
    ]);
  });

  it("loses nothing published while the backfill query is in flight", async () => {
    const room = await roomWithGuest();
    const seen = await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "already seen",
    });

    // Hold `listAfter` open so a message can land in the window that a
    // query-then-subscribe order would leave unguarded (ADR 0044).
    let openTheGate = () => {};
    ctx.holdBackfill(
      new Promise<void>((resolve) => {
        openTheGate = resolve;
      }),
    );

    const stream = await service.watchMessages({
      roomId: room.id,
      requesterId: GUEST,
      lastEventId: seen.id,
    });
    const received = take(stream, 1);

    // Published *during* the backfill: in the buffer and in the query result.
    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "sent mid-backfill",
    });
    openTheGate();

    await expect(received).resolves.toEqual(["sent mid-backfill"]);
  });

  it("delivers a message caught by both paths exactly once", async () => {
    const room = await roomWithGuest();
    const seen = await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "already seen",
    });

    let openTheGate = () => {};
    ctx.holdBackfill(
      new Promise<void>((resolve) => {
        openTheGate = resolve;
      }),
    );

    const stream = await service.watchMessages({
      roomId: room.id,
      requesterId: GUEST,
      lastEventId: seen.id,
    });
    const received = take(stream, 2);

    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "overlapping",
    });
    openTheGate();
    // If the overlap were delivered twice, the second item would be
    // "overlapping" again rather than this.
    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "the one after",
    });

    await expect(received).resolves.toEqual(["overlapping", "the one after"]);
  });

  it("does not wake a chat stream on a playback command", async () => {
    const room = await roomWithGuest();
    const musicId = await seedMusic(ctx.musicRepository, "track");
    await service.queueMusic({
      roomId: room.id,
      musicId,
      requesterId: OWNER,
    });
    const stream = await service.watchMessages({
      roomId: room.id,
      requesterId: GUEST,
    });
    const received = take(stream, 1);

    await service.commandPlayback({
      roomId: room.id,
      requesterId: OWNER,
      command: { type: "SELECT_TRACK", musicId },
    });
    await service.sendMessage({
      roomId: room.id,
      requesterId: OWNER,
      body: "only this",
    });

    await expect(received).resolves.toEqual(["only this"]);
  });
});
