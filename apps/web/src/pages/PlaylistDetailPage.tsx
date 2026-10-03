import { ChevronLeft, ListMusic, Play } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../api/trpc";
import { SharePanel } from "../components/share/SharePanel";
import { Button } from "../components/ui/button";
import { usePlayerStore } from "../store/player";

export function PlaylistDetailPage() {
  const { id } = useParams();
  const playlistId = id ?? "";
  const utils = trpc.useUtils();
  const playQueue = usePlayerStore((s) => s.playQueue);

  const playlist = trpc.playlists.get.useQuery(
    { id: playlistId },
    { enabled: playlistId.length > 0 },
  );
  const allMusics = trpc.musics.list.useQuery();
  const members = trpc.playlists.members.useQuery(
    { playlistId },
    { enabled: playlistId.length > 0 },
  );
  const addMusic = trpc.playlists.addMusic.useMutation({
    onSuccess: () => utils.playlists.get.invalidate({ id: playlistId }),
  });

  const [selected, setSelected] = useState("");

  // Someone else's change arrives as a signal, not as state (api ADR 0039), so
  // the response is simply to refetch what it affected. That also makes a
  // missed event harmless: the next refetch is authoritative either way.
  trpc.playlists.onChanged.useSubscription(
    { playlistId },
    {
      enabled: playlistId.length > 0,
      onData: (event) => {
        if (event.type === "MUSIC_ADDED") {
          utils.playlists.get.invalidate({ id: playlistId });
        }
        if (event.type === "MEMBER_JOINED") {
          utils.playlists.members.invalidate({ playlistId });
        }
      },
    },
  );

  if (playlist.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (playlist.error?.data?.code === "FORBIDDEN") {
    return (
      <p className="text-destructive">You are not a member of this playlist.</p>
    );
  }
  if (playlist.error || playlist.data === undefined) {
    return <p className="text-destructive">Playlist not found.</p>;
  }

  const { playlist: details, musics } = playlist.data;

  return (
    <div className="space-y-5">
      <div>
        <Link
          to="/playlists"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Your playlists
        </Link>
        <div className="flex flex-col gap-4 pt-3 sm:flex-row sm:items-center sm:gap-6">
          <div className="grid h-24 w-24 shrink-0 place-items-center rounded bg-gradient-to-br from-secondary to-muted sm:h-32 sm:w-32">
            <ListMusic className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
            <div>
              <h1 className="truncate text-2xl font-bold sm:text-3xl">
                {details.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {musics.length} track(s)
              </p>
            </div>
            <Button
              size="icon-lg"
              className="rounded-full"
              onClick={() => playQueue(musics, 0)}
              disabled={musics.length === 0}
              aria-label="Play playlist"
            >
              <Play className="h-5 w-5" fill="currentColor" />
            </Button>
          </div>
        </div>
      </div>

      {musics.length === 0 ? (
        <p className="text-muted-foreground">No tracks yet — add one below.</p>
      ) : (
        <ul className="space-y-1">
          {musics.map((track, i) => (
            <li
              key={track.id}
              className="flex items-center gap-3 rounded-md p-2 hover:bg-secondary"
            >
              <span className="w-6 text-right text-sm text-muted-foreground">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1 truncate font-semibold">
                {track.name}
              </div>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => playQueue(musics, i)}
                aria-label={`Play ${track.name}`}
              >
                <Play className="h-4 w-4" fill="currentColor" />
                <span className="hidden sm:inline">Play</span>
              </Button>
            </li>
          ))}
        </ul>
      )}

      <SharePanel
        resourceType="PLAYLIST"
        resourceId={playlistId}
        members={members.data ?? []}
      />

      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (selected.length > 0) {
            addMusic.mutate({ playlistId, musicId: selected });
          }
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            Add a track
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
          disabled={selected.length === 0 || addMusic.isPending}
        >
          Add
        </Button>
      </form>
    </div>
  );
}
