import { livePositionMs } from "@integration-system/api/playback";
import { useCallback, useEffect, useRef } from "react";
import { type PlayerTrack, usePlayerStore } from "../../store/player";

/** How far out of step before we yank a listener back, in seconds. */
const DRIFT_TOLERANCE_SECONDS = 2;

/** How often to check for drift between anchors. */
const DRIFT_CHECK_MS = 5_000;

/**
 * The room's playback anchor as it arrives over the wire. `playbackUpdatedAt`
 * really is a `Date` here — the superjson transformer (api ADR 0042) makes the
 * inferred type true, so no re-parsing is needed.
 */
export interface RoomAnchorLike {
  currentMusicId: string | null;
  positionMs: number;
  isPlaying: boolean;
  playbackUpdatedAt: Date;
}

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
    seekTo(target);
    if (anchor.isPlaying) {
      play();
    } else {
      pause();
    }
  }, [anchor, enabled, targetSeconds, playQueue, seekTo, play, pause]);

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
