import { livePositionMs } from "@integration-system/api/playback";
import { useCallback, useEffect, useRef } from "react";
import { type PlayerTrack, usePlayerStore } from "../../store/player";
import type { RoomAnchorLike } from "../../store/room-session";

/**
 * How far out of step before we yank a listener back, in seconds.
 *
 * Two people in one room at half a second apart already sound like an echo, so
 * this is deliberately tight. It cannot go much tighter: `currentTime` reaches
 * the store through `timeupdate`, which fires roughly four times a second, so a
 * reading is up to ~0.25s stale and a smaller window would seek on noise.
 */
const DRIFT_TOLERANCE_SECONDS = 0.5;

/** How often to check for drift between anchors. */
const DRIFT_CHECK_MS = 1_000;

export interface UseRoomPlaybackSyncOptions {
  anchor: RoomAnchorLike | undefined;
  /** The room's queue, in order — the anchor's track must be one of these. */
  musics: PlayerTrack[];
  /** The server's clock when the anchor was observed, for skew correction. */
  serverNow: Date | undefined;
  enabled: boolean;
}

/**
 * Follows a room's shared position (api ADR 0041).
 *
 * The server never ticks: it publishes an anchor, and every listener derives
 * the live position from it with the *same* function the server uses — imported
 * from the API workspace rather than reimplemented, because a room where the
 * two sides disagree is exactly the bug this feature cannot have.
 *
 * Clock skew is measured against the server's `now` and subtracted, so a
 * listener with a badly-set clock still lands on the right second.
 */
export function useRoomPlaybackSync({
  anchor,
  musics,
  serverNow,
  enabled,
}: UseRoomPlaybackSyncOptions): void {
  const playQueue = usePlayerStore((s) => s.playQueue);
  const seekTo = usePlayerStore((s) => s.seekTo);
  const play = usePlayerStore((s) => s.play);
  const pause = usePlayerStore((s) => s.pause);
  // A seek written before the media is ready is honoured late, against a
  // position the room has already left. Re-anchoring when this flips is what
  // stops a listener from being permanently behind by however long they took
  // to load.
  const canPlay = usePlayerStore((s) => s.canPlay);

  /** How far ahead this browser's clock runs, in ms. */
  const skewRef = useRef(0);
  useEffect(() => {
    if (serverNow !== undefined) {
      skewRef.current = Date.now() - serverNow.getTime();
    }
  }, [serverNow]);

  // The queue is a fresh array on every render of the page, so it is read
  // through a ref: re-syncing on its identity would fight the listener instead
  // of following the room. The anchor, by contrast, is state — its identity
  // changes when the room actually moved, which is exactly when to re-sync.
  const musicsRef = useRef(musics);
  musicsRef.current = musics;

  /** Where the room is right now, in seconds, or null if it is on no track. */
  const targetSeconds = useCallback(
    (current: RoomAnchorLike | undefined): number | null => {
      if (current === undefined || current.currentMusicId === null) {
        return null;
      }
      const serverish = new Date(Date.now() - skewRef.current);
      return livePositionMs(current, serverish) / 1000;
    },
    [],
  );

  useEffect(() => {
    const target = targetSeconds(anchor);
    if (!enabled || anchor === undefined || target === null) {
      return;
    }

    const queue = musicsRef.current;
    const index = queue.findIndex(
      (track) => track.id === anchor.currentMusicId,
    );
    if (index < 0) {
      // The anchor points at a track this client has not loaded yet; the next
      // refetch brings it, and this effect runs again.
      return;
    }

    const player = usePlayerStore.getState();
    const playing = player.index >= 0 ? player.queue[player.index] : undefined;
    if (playing?.id !== anchor.currentMusicId) {
      playQueue(queue, index);
    }
    // Only seek once the element can act on it; this effect runs again on
    // `canPlay`, and `targetSeconds` is recomputed then, so the position used
    // is the room's at the moment the seek actually lands.
    if (canPlay) {
      seekTo(target);
    }
    if (anchor.isPlaying) {
      play();
    } else {
      pause();
    }
  }, [anchor, enabled, canPlay, targetSeconds, playQueue, seekTo, play, pause]);

  // Between anchors everyone free-runs, so a little divergence accumulates —
  // a tab throttled in the background is the usual cause. Nudge it back.
  useEffect(() => {
    if (!enabled || anchor === undefined || !anchor.isPlaying) {
      return;
    }

    const timer = window.setInterval(() => {
      const target = targetSeconds(anchor);
      if (target === null) {
        return;
      }
      const player = usePlayerStore.getState();
      const playing =
        player.index >= 0 ? player.queue[player.index] : undefined;
      if (playing?.id !== anchor.currentMusicId) {
        return;
      }
      if (Math.abs(player.currentTime - target) > DRIFT_TOLERANCE_SECONDS) {
        seekTo(target);
      }
    }, DRIFT_CHECK_MS);

    return () => window.clearInterval(timer);
  }, [anchor, enabled, targetSeconds, seekTo]);
}
