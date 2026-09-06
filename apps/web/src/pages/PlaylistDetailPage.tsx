import { ChevronLeft, ListMusic, Play } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../api/trpc";
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
  const addMusic = trpc.playlists.addMusic.useMutation({
    onSuccess: () => utils.playlists.get.invalidate({ id: playlistId }),
  });

  const [selected, setSelected] = useState("");

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
        <div className="flex items-center gap-6 pt-3">
          <div className="grid h-32 w-32 shrink-0 place-items-center rounded bg-gradient-to-br from-secondary to-muted">
            <ListMusic className="h-12 w-12 text-muted-foreground" />
          </div>
          <div className="flex flex-1 items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">{details.name}</h1>
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
              <div className="min-w-0 flex-1 font-semibold">{track.name}</div>
              <Button variant="secondary" onClick={() => playQueue(musics, i)}>
                <Play className="h-4 w-4" fill="currentColor" />
                Play
              </Button>
            </li>
          ))}
        </ul>
      )}

      <form
        className="flex items-end gap-2"
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
