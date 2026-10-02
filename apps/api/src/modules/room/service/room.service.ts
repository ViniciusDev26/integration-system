import type { Room } from "../../../shared/db/schema/rooms.js";
import type { RoomEvent } from "../room.events.js";
import { roomTopic } from "../room.events.js";
import { applyPlaybackCommand } from "../room.playback.js";
import {
  RoomForbiddenError,
  RoomMusicNotFoundError,
  RoomNotFoundError,
} from "./room.service.errors.js";
import type { RoomService, RoomServiceOptions } from "./room.service.types.js";

export function createRoomService(options: RoomServiceOptions): RoomService {
  const {
    roomRepository,
    musicRepository,
    objectStorage,
    eventBus,
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
