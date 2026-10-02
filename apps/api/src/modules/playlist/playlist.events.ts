import type { EventBus } from "../../shared/realtime/event-bus.js";

/**
 * What changed in a playlist, pushed to its members over a subscription
 * (ADR 0039).
 *
 * These are **signals, not state**: each says enough to show a notice and to
 * know what to refetch, and the authoritative data stays one query away. That
 * is deliberate — it means a client that reconnects after missing events is
 * correct simply by refetching, so playlist changes need no `tracked()` replay.
 * Chat will be the opposite case, because there the messages *are* the data.
 */
export type PlaylistEvent =
  | {
      type: "MUSIC_ADDED";
      playlistId: string;
      musicId: string;
      /** `users.id` of whoever added it, so a client can ignore its own echo. */
      actorId: string;
    }
  | {
      type: "MEMBER_JOINED";
      playlistId: string;
      /** `users.id` of whoever just joined. */
      actorId: string;
    };

export type PlaylistEventBus = EventBus<PlaylistEvent>;

/**
 * The topic a playlist's events are published on. One topic per playlist, which
 * is how fan-out to "just this playlist's members" is expressed without a rooms
 * primitive (ADR 0039/0040).
 */
export function playlistTopic(playlistId: string): string {
  return `playlist:${playlistId}`;
}
