import { create } from "zustand";

/** A track the player can play — the shape returned by `musics.list` / `playlists.get`. */
export interface PlayerTrack {
  id: string;
  name: string;
  playbackUrl: string;
  thumbnailUrl: string | null;
  genres: string[];
}

export type RepeatMode = "off" | "all" | "one";

/** A queue entry: a track plus a stable id (the same track may be queued twice). */
export interface QueueItem {
  uid: string;
  track: PlayerTrack;
}

function toItem(track: PlayerTrack): QueueItem {
  return { uid: crypto.randomUUID(), track };
}

interface PlayerState {
  queue: QueueItem[];
  index: number; // -1 when the queue is empty
  isPlaying: boolean;
  volume: number; // 0..1
  currentTime: number;
  duration: number;
  repeat: RepeatMode;

  /** Play a single track (queue of one). */
  playTrack: (track: PlayerTrack) => void;
  /** Play a list of tracks, starting at `startIndex` (a playlist). */
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Manual next: advance, wrapping to the start at the end. */
  next: () => void;
  /** Manual previous: go back, wrapping to the end at the start. */
  previous: () => void;
  /** Append a track to the queue (starts it if the queue was empty). */
  addToQueue: (track: PlayerTrack) => void;
  /** Remove the queue item at `at`, adjusting the current index. */
  removeFromQueue: (at: number) => void;
  /** Jump to and play the queue item at `at`. */
  playAt: (at: number) => void;
  /** Called when a track finishes (`ended`), honoring `repeat` for auto-advance. */
  trackEnded: () => void;

  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  cycleRepeat: () => void;
}

/**
 * Global audio player state (ADR 0005/0011). Playback happens ONLY through this
 * store + the single `<audio>` in the app shell; pages never play audio inline.
 */
export const usePlayerStore = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  repeat: "off",

  playTrack(track) {
    set({ queue: [toItem(track)], index: 0, isPlaying: true, currentTime: 0 });
  },

  playQueue(tracks, startIndex = 0) {
    if (tracks.length === 0) {
      return;
    }
    const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    set({ queue: tracks.map(toItem), index, isPlaying: true, currentTime: 0 });
  },

  play() {
    if (get().index >= 0) {
      set({ isPlaying: true });
    }
  },
  pause() {
    set({ isPlaying: false });
  },
  toggle() {
    const { index, isPlaying } = get();
    if (index >= 0) {
      set({ isPlaying: !isPlaying });
    }
  },

  next() {
    const { queue, index } = get();
    if (queue.length === 0) {
      return;
    }
    const nextIndex = index >= queue.length - 1 ? 0 : index + 1;
    set({ index: nextIndex, isPlaying: true, currentTime: 0 });
  },

  previous() {
    const { queue, index } = get();
    if (queue.length === 0) {
      return;
    }
    const prevIndex = index <= 0 ? queue.length - 1 : index - 1;
    set({ index: prevIndex, isPlaying: true, currentTime: 0 });
  },

  addToQueue(track) {
    set((s) => {
      const queue = [...s.queue, toItem(track)];
      return s.index < 0 ? { queue, index: 0 } : { queue };
    });
  },

  removeFromQueue(at) {
    set((s) => {
      if (at < 0 || at >= s.queue.length) {
        return {};
      }
      const queue = s.queue.filter((_, i) => i !== at);
      if (queue.length === 0) {
        return {
          queue,
          index: -1,
          isPlaying: false,
          currentTime: 0,
          duration: 0,
        };
      }
      if (at < s.index) {
        return { queue, index: s.index - 1 };
      }
      if (at === s.index) {
        // Removing the current track: fall onto the next one (same index).
        return {
          queue,
          index: Math.min(s.index, queue.length - 1),
          currentTime: 0,
        };
      }
      return { queue };
    });
  },

  playAt(at) {
    set((s) =>
      at < 0 || at >= s.queue.length
        ? {}
        : { index: at, isPlaying: true, currentTime: 0 },
    );
  },

  trackEnded() {
    // `repeat: "one"` is handled in the audio component (replay in place).
    const { queue, index, repeat } = get();
    if (index < queue.length - 1) {
      set({ index: index + 1, currentTime: 0, isPlaying: true });
    } else if (repeat === "all") {
      set({ index: 0, currentTime: 0, isPlaying: true });
    } else {
      set({ isPlaying: false });
    }
  },

  setVolume(volume) {
    set({ volume: Math.min(Math.max(volume, 0), 1) });
  },
  setCurrentTime(time) {
    set({ currentTime: time });
  },
  setDuration(duration) {
    set({ duration });
  },
  cycleRepeat() {
    const order: RepeatMode[] = ["off", "all", "one"];
    const current = get().repeat;
    const nextMode =
      order[(order.indexOf(current) + 1) % order.length] ?? "off";
    set({ repeat: nextMode });
  },
}));
