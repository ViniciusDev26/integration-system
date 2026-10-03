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

/**
 * Something that owns playback on this browser's behalf — a listening room
 * (web ADR 0017). While one is registered, the transport buttons stop driving
 * the local `<audio>` and ask it instead, so pressing play in the bar does what
 * it looks like it does: it plays for everyone.
 *
 * The player knows nothing about rooms; it renders `label` and offers `leave`.
 */
export interface PlaybackRemote {
  /** Named in the bar, so a listener can see their controls are not local. */
  label: string;
  leave: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  /** Pick the queue item at `at` for everyone. */
  selectAt: (at: number) => void;
}

interface PlayerState {
  queue: PlayerTrack[];
  index: number; // -1 when the queue is empty
  isPlaying: boolean;
  volume: number; // 0..1
  currentTime: number;
  duration: number;
  /**
   * A seek the store is asking the audio element to perform. The element is the
   * only thing that can actually seek, so a command from outside the player —
   * a room anchor, say — lands here and `Player` applies it. The counter makes
   * two seeks to the same position distinguishable.
   */
  pendingSeek: { toSeconds: number; nonce: number } | null;
  repeat: RepeatMode;
  /** Set while something else owns playback; see {@link PlaybackRemote}. */
  remote: PlaybackRemote | null;
  /**
   * True once the browser has refused to start audio for want of a user
   * gesture. The store would otherwise claim to be playing while silent.
   */
  autoplayBlocked: boolean;
  /**
   * Whether the element can actually act on a seek yet. Writing `currentTime`
   * before the media has loaded is honoured late, against a position the room
   * has already moved past — which is how a listener ends up permanently
   * behind. Anything following a shared anchor must re-anchor when this flips.
   */
  canPlay: boolean;

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

  /**
   * What a **transport button** does, as opposed to what following an anchor
   * does. These go to the `remote` when one is registered and act locally
   * otherwise. Everything that merely *follows* a remote — `play`, `pause`,
   * `seekTo`, `playQueue` — must keep calling the plain actions above, or a
   * room would command itself in a loop.
   */
  requestToggle: () => void;
  requestNext: () => void;
  requestPrevious: () => void;
  requestSeek: (seconds: number) => void;
  requestPlayAt: (at: number) => void;

  setRemote: (remote: PlaybackRemote | null) => void;
  /** The browser refused to start audio without a gesture. */
  autoplayRefused: () => void;
  /** Audio is running again, so any refusal no longer stands. */
  autoplayAllowed: () => void;
  /** The element has enough data to play and to honour a seek. */
  mediaReady: () => void;
  /** A new source is loading; seeks will not land until it is ready. */
  mediaLoading: () => void;
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
  /** Asks the audio element to seek. Used to follow a room's shared position. */
  seekTo: (seconds: number) => void;
  /** Clears a seek once the element has performed it. */
  seekApplied: (nonce: number) => void;
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
  pendingSeek: null,
  repeat: "off",
  remote: null,
  autoplayBlocked: false,
  canPlay: false,

  playTrack(track) {
    set({ queue: [track], index: 0, isPlaying: true, currentTime: 0 });
  },

  playQueue(tracks, startIndex = 0) {
    if (tracks.length === 0) {
      return;
    }
    const index = Math.min(Math.max(startIndex, 0), tracks.length - 1);
    set({ queue: tracks, index, isPlaying: true, currentTime: 0 });
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
      // No duplicates: a track can be in the queue at most once.
      if (s.queue.some((t) => t.id === track.id)) {
        return {};
      }
      const queue = [...s.queue, track];
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

  requestToggle() {
    const { remote } = get();
    if (remote !== null) {
      remote.toggle();
      return;
    }
    get().toggle();
  },

  requestNext() {
    const { remote } = get();
    if (remote !== null) {
      remote.next();
      return;
    }
    get().next();
  },

  requestPrevious() {
    const { remote } = get();
    if (remote !== null) {
      remote.previous();
      return;
    }
    get().previous();
  },

  requestSeek(seconds) {
    const { remote } = get();
    if (remote !== null) {
      remote.seek(seconds);
      return;
    }
    get().seekTo(seconds);
  },

  requestPlayAt(at) {
    const { remote } = get();
    if (remote !== null) {
      remote.selectAt(at);
      return;
    }
    get().playAt(at);
  },

  setRemote(remote) {
    set({ remote });
  },

  autoplayRefused() {
    set({ autoplayBlocked: true });
  },
  autoplayAllowed() {
    set((state) => (state.autoplayBlocked ? { autoplayBlocked: false } : {}));
  },

  mediaReady() {
    set((state) => (state.canPlay ? {} : { canPlay: true }));
  },
  mediaLoading() {
    set((state) => (state.canPlay ? { canPlay: false } : {}));
  },

  setVolume(volume) {
    set({ volume: Math.min(Math.max(volume, 0), 1) });
  },
  setCurrentTime(time) {
    set({ currentTime: time });
  },
  seekTo(seconds) {
    const target = Math.max(0, seconds);
    set((state) => ({
      currentTime: target,
      pendingSeek: {
        toSeconds: target,
        nonce: (state.pendingSeek?.nonce ?? 0) + 1,
      },
    }));
  },
  seekApplied(nonce) {
    set((state) =>
      state.pendingSeek?.nonce === nonce ? { pendingSeek: null } : {},
    );
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
