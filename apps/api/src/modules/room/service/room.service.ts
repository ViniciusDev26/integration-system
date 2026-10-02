import type { Room } from "../../../shared/db/schema/rooms.js";
import type { RoomMessageSummary } from "../repository/room-message.repository.js";
import type { RoomEvent } from "../room.events.js";
import { roomChatTopic, roomTopic } from "../room.events.js";
import { applyPlaybackCommand } from "../room.playback.js";
import {
  DEFAULT_HISTORY_LIMIT,
  MAX_BACKFILL,
} from "./room.service.constants.js";
import {
  RoomForbiddenError,
  RoomMusicNotFoundError,
  RoomNotFoundError,
} from "./room.service.errors.js";
import type { RoomService, RoomServiceOptions } from "./room.service.types.js";

export function createRoomService(options: RoomServiceOptions): RoomService {
  const {
    roomRepository,
    roomMessageRepository,
    musicRepository,
    objectStorage,
    eventBus,
    chatEventBus,
    roomRegistry,
  } = options;
  const now = options.now ?? (() => new Date());

  /** Loads a room the requester belongs to, or throws NotFound/Forbidden. */
  async function requireMembership(
    roomId: string,
    requesterId: string,
  ): Promise<Room> {
    const room = await roomRepository.findById(roomId);
    if (room === null) {
      throw new RoomNotFoundError(roomId);
    }
    if ((await roomRepository.getMemberType(roomId, requesterId)) === null) {
      throw new RoomForbiddenError(roomId);
    }
    return room;
  }

  function announcePresence(roomId: string): void {
    eventBus.publish(roomTopic(roomId), {
      type: "PRESENCE_CHANGED",
      roomId,
      present: roomRegistry.members(roomId),
    });
  }

  return {
    async createForUser({ name, ownerId }) {
      return roomRepository.create({ name, ownerId });
    },

    async listForUser(userId) {
      return roomRepository.listForMember(userId);
    },

    async listMusics({ roomId, requesterId }) {
      await requireMembership(roomId, requesterId);
      return roomRepository.listMusics(roomId);
    },

    async get({ roomId, requesterId }) {
      const room = await requireMembership(roomId, requesterId);
      const tracks = await roomRepository.listMusics(roomId);

      const musics = await Promise.all(
        tracks.map(async (track) => ({
          id: track.id,
          name: track.name,
          genres: track.genres,
          playbackUrl: await objectStorage.getSignedUrl(track.objectKey),
          thumbnailUrl:
            track.thumbnailObjectKey === null
              ? null
              : await objectStorage.getSignedUrl(track.thumbnailObjectKey),
        })),
      );

      return {
        room,
        musics,
        present: roomRegistry.members(roomId),
        serverNow: now(),
      };
    },

    async listMembers({ roomId, requesterId }) {
      await requireMembership(roomId, requesterId);
      return roomRepository.listMembers(roomId);
    },

    async queueMusic({ roomId, musicId, requesterId }) {
      await requireMembership(roomId, requesterId);

      if ((await musicRepository.findById(musicId)) === null) {
        throw new RoomMusicNotFoundError(musicId);
      }

      await roomRepository.addMusic({ roomId, musicId });

      eventBus.publish(roomTopic(roomId), {
        type: "MUSIC_QUEUED",
        roomId,
        musicId,
        actorId: requesterId,
      });
    },

    async commandPlayback({ roomId, requesterId, command }) {
      const room = await requireMembership(roomId, requesterId);

      // Picking a track only makes sense for one that is actually queued —
      // otherwise a client could point the room at anything in the catalogue.
      if (command.type === "SELECT_TRACK") {
        const queued = await roomRepository.listMusics(roomId);
        if (!queued.some((track) => track.id === command.musicId)) {
          throw new RoomMusicNotFoundError(command.musicId);
        }
      }

      const at = now();
      const anchor = applyPlaybackCommand(room, command, at);
      const updated = await roomRepository.setPlayback(roomId, anchor);
      if (updated === null) {
        throw new RoomNotFoundError(roomId);
      }

      eventBus.publish(roomTopic(roomId), {
        type: "PLAYBACK_CHANGED",
        roomId,
        actorId: requesterId,
        anchor,
        serverNow: at,
      });

      return updated;
    },

    async sendMessage({ roomId, requesterId, body }) {
      await requireMembership(roomId, requesterId);

      const message = await roomMessageRepository.create({
        roomId,
        userId: requesterId,
        body,
      });

      chatEventBus.publish(roomChatTopic(roomId), message);
      return message;
    },

    async listMessages({ roomId, requesterId, limit }) {
      await requireMembership(roomId, requesterId);
      return roomMessageRepository.listRecent(
        roomId,
        Math.min(limit ?? DEFAULT_HISTORY_LIMIT, MAX_BACKFILL),
      );
    },

    async watchMessages({ roomId, requesterId, lastEventId, signal }) {
      await requireMembership(roomId, requesterId);

      // Step 1 — subscribe *before* querying. The bus registers a subscriber
      // eagerly and buffers from this instant (ADR 0039), so a message
      // published while step 2 runs is waiting here rather than lost.
      const live = chatEventBus.subscribe(roomChatTopic(roomId), { signal });

      async function* backfillThenLive(): AsyncGenerator<RoomMessageSummary> {
        // Everything sorts after the empty string, so with no cursor nothing
        // is skipped.
        let lastYielded = lastEventId ?? "";

        // Step 2/3 — what the client missed while it was away.
        if (lastEventId !== undefined) {
          const missed = await roomMessageRepository.listAfter({
            roomId,
            afterId: lastEventId,
            limit: MAX_BACKFILL,
          });
          for (const message of missed) {
            lastYielded = message.id;
            yield message;
          }
        }

        // Step 4 — live, minus the overlap. A message published during step 2
        // is legitimately in both the query and the buffer; ids are
        // time-ordered (ADR 0044), so comparing against the high-water mark
        // delivers it exactly once.
        for await (const message of live) {
          if (message.id <= lastYielded) {
            continue;
          }
          lastYielded = message.id;
          yield message;
        }
      }

      return backfillThenLive();
    },

    async watch({ roomId, requesterId, signal }) {
      await requireMembership(roomId, requesterId);

      // Presence *is* the lifetime of this stream (ADR 0041): joining here and
      // leaving in `finally` means a dropped socket cleans itself up, with no
      // heartbeat and nothing to reap.
      const leave = roomRegistry.join(roomId, requesterId);
      const stream = eventBus.subscribe(roomTopic(roomId), { signal });
      announcePresence(roomId);

      async function* withPresence(): AsyncGenerator<RoomEvent> {
        try {
          yield* stream;
        } finally {
          leave();
          announcePresence(roomId);
        }
      }

      return withPresence();
    },
  };
}
