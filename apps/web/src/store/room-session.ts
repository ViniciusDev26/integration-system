import { create } from "zustand";
import type { PlayerTrack } from "./player";

/**
 * A room's playback anchor as it arrives over the wire. `playbackUpdatedAt`
 * really is a `Date` here — the superjson transformer (api ADR 0042) makes the
 * inferred type true, so no re-parsing is needed.
 */
export interface RoomAnchorLike {
  currentMusicId: string | null;
  positionMs: number;
  isPlaying: boolean;
  playbackUpdatedAt: Date;
}

interface RoomSessionState {
  /** The room this browser is listening to, or `null` when it is not in one. */
  roomId: string | null;
  name: string | null;
  anchor: RoomAnchorLike | undefined;
  /** The server's clock when the anchor was observed, for skew correction. */
  serverNow: Date | undefined;
  present: readonly string[];
  /** The room's queue, in order. */
  musics: PlayerTrack[];

  /** Start listening to a room. Entering a different one replaces the first. */
  enter: (roomId: string) => void;
  /** Stop listening. Presence drops and the shared anchor stops being followed. */
  leave: () => void;
  /** Seed from a `rooms.get` snapshot. */
  observe: (snapshot: {
    roomId: string;
    name: string;
    anchor: RoomAnchorLike;
    serverNow: Date;
    present: readonly string[];
    musics: PlayerTrack[];
  }) => void;
  /** Apply a `PLAYBACK_CHANGED` event. */
  applyPlayback: (anchor: RoomAnchorLike, serverNow: Date) => void;
  /** Apply a `PRESENCE_CHANGED` event. */
  setPresent: (present: readonly string[]) => void;
}

/** Everything a room seeds, cleared. Not `as const` — zustand sets mutably. */
const EMPTY: Omit<
  RoomSessionState,
  "enter" | "leave" | "observe" | "applyPlayback" | "setPresent"
> = {
  roomId: null,
  name: null,
  anchor: undefined,
  serverNow: undefined,
  present: [],
  musics: [],
};

/**
 * The room this browser is listening to (web ADR 0017).
 *
 * This is **global, like the player**, and deliberately not page state. A room
 * is something you are *in*, not a screen you are looking at: the audio keeps
 * playing when you browse to another page, so what follows the room's anchor
 * has to outlive that page too. Holding it here is what lets a single
 * shell-level subscription keep every listener in step wherever they navigate.
 *
 * Only `RoomSession` writes the live fields; pages read them.
 */
export const useRoomSessionStore = create<RoomSessionState>((set, get) => ({
  ...EMPTY,

  enter(roomId) {
    if (get().roomId === roomId) {
      return;
    }
    // Entering a different room drops everything the previous one seeded, so a
    // stale anchor cannot be applied to the new room's queue.
    set({ ...EMPTY, roomId });
  },

  leave() {
    set({ ...EMPTY });
  },

  observe({ roomId, name, anchor, serverNow, present, musics }) {
    // A snapshot that arrives after the listener moved on belongs to the room
    // they left; dropping it keeps the store honest about which room is live.
    if (get().roomId !== roomId) {
      return;
    }
    set({ name, anchor, serverNow, present, musics });
  },

  applyPlayback(anchor, serverNow) {
    set({ anchor, serverNow });
  },

  setPresent(present) {
    set({ present });
  },
}));
