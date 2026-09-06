import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Button } from "../components/ui/button";

export function PlaylistDetailPage() {
  const { id } = useParams();
  const playlistId = id ?? "";
  const utils = trpc.useUtils();

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
    return <p className="text-gray-500">Loading…</p>;
  }
  if (playlist.error?.data?.code === "FORBIDDEN") {
    return (
      <p className="text-red-500">You are not a member of this playlist.</p>
    );
  }
  if (playlist.error || playlist.data === undefined) {
    return <p className="text-red-500">Playlist not found.</p>;
  }

  const { playlist: details, musics } = playlist.data;

  return (
    <div className="space-y-5">
      <div>
        <Link to="/playlists" className="text-sm text-gray-500 hover:underline">
          ← Your playlists
        </Link>
        <h1 className="text-xl font-bold">{details.name}</h1>
        <p className="text-sm text-gray-500">{musics.length} track(s)</p>
      </div>

      {musics.length === 0 ? (
        <p className="text-gray-500">No tracks yet — add one below.</p>
      ) : (
        <ul className="space-y-3">
          {musics.map((track) => (
            <li
              key={track.id}
              className="rounded-lg border border-gray-500/20 p-3"
            >
              <div className="font-semibold">{track.name}</div>
              {/* biome-ignore lint/a11y/useMediaCaption: user-uploaded audio has no captions */}
              <audio
                controls
                preload="none"
                src={track.playbackUrl}
                className="mt-2 w-full"
              />
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
          <span className="text-sm font-semibold text-gray-500">
            Add a track
          </span>
          <select
            className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 text-sm dark:border-gray-600"
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
