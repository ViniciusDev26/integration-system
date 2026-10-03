import { ChevronLeft, Pause, Play, Radio } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../api/trpc";
import { RoomChat } from "../components/room/RoomChat";
import { SharePanel } from "../components/share/SharePanel";
import { Button } from "../components/ui/button";
import { useRoomSessionStore } from "../store/room-session";

/**
 * A listening room (api ADR 0041). Transport controls here issue **server**
 * commands rather than driving this browser's player — the room's anchor is the
 * single source of truth, and every listener follows it.
 *
 * This page does not follow the room itself (web ADR 0017): opening it puts the
 * browser *in* the room, and `RoomSession` in the app shell does the following,
 * so a listener who navigates away keeps hearing what everyone else hears.
 * Here we only render what that session already knows.
 */
export function RoomDetailPage() {
  const { id } = useParams();
  const roomId = id ?? "";
  const enabled = roomId.length > 0;
  const utils = trpc.useUtils();

  const room = trpc.rooms.get.useQuery({ roomId }, { enabled });
  const members = trpc.rooms.members.useQuery({ roomId }, { enabled });
  const allMusics = trpc.musics.list.useQuery();

  const enter = useRoomSessionStore((s) => s.enter);
  const anchor = useRoomSessionStore((s) => s.anchor);
  const present = useRoomSessionStore((s) => s.present);

  // Opening the page joins the room. Leaving the page deliberately does not
  // leave it — that is what the player bar's "Leave" is for.
  useEffect(() => {
    if (enabled) {
      enter(roomId);
    }
  }, [enabled, roomId, enter]);

  const command = trpc.rooms.commandPlayback.useMutation();
  const queueMusic = trpc.rooms.queueMusic.useMutation({
    onSuccess: () => utils.rooms.get.invalidate({ roomId }),
  });
  const [selected, setSelected] = useState("");

  if (room.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (room.error?.data?.code === "FORBIDDEN") {
    return <p className="text-destructive">You are not in this room.</p>;
  }
  if (room.error || room.data === undefined) {
    return <p className="text-destructive">Room not found.</p>;
  }

  const { room: details, musics } = room.data;
  const isPlaying = anchor?.isPlaying ?? false;
  const currentId = anchor?.currentMusicId ?? null;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/rooms"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Rooms
        </Link>
        <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded bg-gradient-to-br from-secondary to-muted sm:h-32 sm:w-32">
            <Radio className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div>
              <h1 className="truncate text-2xl font-bold sm:text-3xl">
                {details.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {musics.length} track(s) · {present.length} listening
              </p>
            </div>
            <Button
              size="icon-lg"
              className="rounded-full"
              disabled={currentId === null || command.isPending}
              aria-label={
                isPlaying ? "Pause for everyone" : "Play for everyone"
              }
              onClick={() =>
                command.mutate({
                  roomId,
                  command: { type: isPlaying ? "PAUSE" : "PLAY" },
                })
              }
            >
              {isPlaying ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="h-5 w-5" fill="currentColor" />
              )}
            </Button>
          </div>
        </div>
        <p className="pt-2 text-xs text-muted-foreground">
          Playing, pausing or picking a track changes it{" "}
          <strong>for everyone in the room</strong>.
        </p>
      </div>

      {musics.length === 0 ? (
        <p className="text-muted-foreground">
          Nothing queued yet — add a track below.
        </p>
      ) : (
        <ul className="space-y-1">
          {musics.map((track, i) => (
            <li
              key={track.id}
              className={`flex items-center gap-3 rounded-md p-2 hover:bg-secondary ${
                track.id === currentId ? "bg-secondary" : ""
              }`}
            >
              <span className="w-6 text-right text-sm text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 truncate font-semibold">
                {track.name}
                {track.id === currentId && (
                  <span className="pl-2 text-xs font-normal text-primary">
                    {isPlaying ? "playing" : "paused"}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 rounded-full"
                disabled={command.isPending}
                aria-label={`Play ${track.name} for everyone`}
                title="Play for everyone"
                onClick={() =>
                  command.mutate({
                    roomId,
                    command: { type: "SELECT_TRACK", musicId: track.id },
                  })
                }
              >
                <Play className="h-4 w-4" fill="currentColor" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <RoomChat roomId={roomId} />

      <SharePanel
        resourceType="ROOM"
        resourceId={roomId}
        members={members.data ?? []}
        present={present}
      />

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (selected.length > 0) {
            queueMusic.mutate({ roomId, musicId: selected });
            setSelected("");
          }
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Queue a track
          </span>
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Choose a track…</option>
            {(allMusics.data ?? []).map((track) => (
              <option key={track.id} value={track.id}>
                {track.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          disabled={selected.length === 0 || queueMusic.isPending}
        >
          Queue
        </Button>
      </form>
    </div>
  );
}
