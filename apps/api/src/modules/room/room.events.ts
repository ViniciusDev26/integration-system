import type { PlaybackAnchor } from "../../shared/db/schema/rooms.js";
import type { EventBus } from "../../shared/realtime/event-bus.js";

/**
 * What happened in a room, pushed to whoever is present (ADR 0039/0041).
 *
 * `PLAYBACK_CHANGED` is the exception to the signal-not-state rule playlists
 * follow: it carries the **anchor itself**, because a client cannot refetch its
 * way to a synchronized position — it needs the exact instant the anchor was
 * set in order to extrapolate. The other two stay signals.
 */
export type RoomEvent =
  | {
      type: "MUSIC_QUEUED";
      roomId: string;
      musicId: string;
      /** `users.id` of whoever queued it. */
      actorId: string;
    }
  | {
      type: "MEMBER_JOINED";
      roomId: string;
      actorId: string;
    }
  | {
      type: "PRESENCE_CHANGED";
      roomId: string;
      /** `users.id` of everyone currently listening, not merely a member. */
      present: readonly string[];
    }
  | {
      type: "PLAYBACK_CHANGED";
      roomId: string;
      /** `users.id` of whoever issued the command. */
      actorId: string;
      anchor: PlaybackAnchor;
      /**
       * The server's clock when this was sent. A client compares it with its
       * own to measure skew and subtract it, so a badly-set client clock does
       * not shift its playback (ADR 0041).
       */
      serverNow: Date;
    };

export type RoomEventBus = EventBus<RoomEvent>;

/** The topic a room's events are published on — one per room (ADR 0039). */
export function roomTopic(roomId: string): string {
  return `room:${roomId}`;
}
