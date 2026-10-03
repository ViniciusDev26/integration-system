import { useEffect, useMemo } from "react";
import { trpc } from "../../api/trpc";
import { usePlayerStore } from "../../store/player";
import { useRoomSessionStore } from "../../store/room-session";
import { useRoomPlaybackSync } from "./useRoomPlaybackSync";

/**
 * Keeps this browser in step with the room it is listening to (web ADR 0017).
 *
 * Rendered by the app shell, **not by the room page**. Following a shared
 * anchor has to last as long as the audio does, and the audio outlives any
 * page: a listener who browses to `/musics` while a room plays used to stop
 * following it silently — the owner would pause and they would keep hearing
 * the track.
 *
 * It owns the room's single `onChanged` subscription, which is also what marks
 * the listener **present** (api ADR 0041), and it registers the transport
 * remote so the player bar's buttons command the room instead of this one
 * browser.
 */
export function RoomSession() {
  const roomId = useRoomSessionStore((s) => s.roomId);

  // Hooks cannot be conditional, so the work lives in a child that only exists
  // while there is a room to do it for.
  return roomId === null ? null : <ActiveRoom roomId={roomId} />;
}

function ActiveRoom({ roomId }: { roomId: string }) {
  const observe = useRoomSessionStore((s) => s.observe);
  const applyPlayback = useRoomSessionStore((s) => s.applyPlayback);
  const setPresent = useRoomSessionStore((s) => s.setPresent);
  const leave = useRoomSessionStore((s) => s.leave);
  const anchor = useRoomSessionStore((s) => s.anchor);
  const serverNow = useRoomSessionStore((s) => s.serverNow);
  const musics = useRoomSessionStore((s) => s.musics);
  const name = useRoomSessionStore((s) => s.name);

  const setRemote = usePlayerStore((s) => s.setRemote);
  const pause = usePlayerStore((s) => s.pause);

  const utils = trpc.useUtils();
  // Same query key as the room page's, so TanStack Query serves both from one
  // request rather than fetching the room twice.
  const room = trpc.rooms.get.useQuery({ roomId });
  const command = trpc.rooms.commandPlayback.useMutation();
  const trackEnded = trpc.rooms.trackEnded.useMutation();

  useEffect(() => {
    if (room.data !== undefined) {
      observe({
        roomId,
        name: room.data.room.name,
        anchor: room.data.room,
        serverNow: room.data.serverNow,
        present: room.data.present,
        musics: room.data.musics,
      });
    }
  }, [room.data, roomId, observe]);

  trpc.rooms.onChanged.useSubscription(
    { roomId },
    {
      onData: (event) => {
        if (event.type === "PLAYBACK_CHANGED") {
          applyPlayback(event.anchor, event.serverNow);
        }
        if (event.type === "PRESENCE_CHANGED") {
          setPresent(event.present);
        }
        if (event.type === "MUSIC_QUEUED") {
          utils.rooms.get.invalidate({ roomId });
        }
        if (event.type === "MEMBER_JOINED") {
          utils.rooms.members.invalidate({ roomId });
        }
      },
    },
  );

  useRoomPlaybackSync({
    anchor,
    musics,
    serverNow,
    enabled: room.data !== undefined,
  });

  // `next`/`previous` are not room commands: the room's vocabulary is PLAY,
  // PAUSE, SEEK and SELECT_TRACK (api ADR 0041), so stepping through the queue
  // is resolved here and sent as the track to select.
  const remote = useMemo(() => {
    const selectAt = (at: number) => {
      const track = musics[at];
      if (track !== undefined) {
        command.mutate({
          roomId,
          command: { type: "SELECT_TRACK", musicId: track.id },
        });
      }
    };

    const step = (by: number) => {
      const at = musics.findIndex((t) => t.id === anchor?.currentMusicId);
      if (at < 0 || musics.length === 0) {
        return;
      }
      selectAt((at + by + musics.length) % musics.length);
    };

    return {
      label: name ?? "a room",
      leave: () => {
        // Leaving means leaving the shared listen, so the audio stops with it.
        pause();
        leave();
      },
      toggle: () =>
        command.mutate({
          roomId,
          command: { type: anchor?.isPlaying === true ? "PAUSE" : "PLAY" },
        }),
      next: () => step(1),
      previous: () => step(-1),
      selectAt,
      // Losing this race is the normal outcome for all but one listener, and
      // the server says so with `advanced: false`; there is nothing to handle.
      trackEnded: (musicId: string) => trackEnded.mutate({ roomId, musicId }),
      seek: (seconds: number) =>
        command.mutate({
          roomId,
          command: { type: "SEEK", positionMs: Math.round(seconds * 1000) },
        }),
    };
  }, [
    roomId,
    name,
    anchor,
    musics,
    command.mutate,
    trackEnded.mutate,
    leave,
    pause,
  ]);

  useEffect(() => {
    setRemote(remote);
    return () => setRemote(null);
  }, [remote, setRemote]);

  return null;
}
