import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Button } from "../components/ui/button";
import { usePlayerStore } from "../store/player";

export function MusicsPage() {
  const musics = trpc.musics.list.useQuery();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);

  if (musics.isLoading) {
    return <p className="text-gray-500">Loading…</p>;
  }
  if (musics.error || musics.data === undefined) {
    return <p className="text-red-500">Failed to load tracks.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">All tracks</h1>
        <Link
          to="/musics/new"
          className="text-sm text-[#1db954] hover:underline"
        >
          Upload a track
        </Link>
      </div>

      {musics.data.length === 0 ? (
        <p className="text-gray-500">No tracks yet.</p>
      ) : (
        <ul className="space-y-3">
          {musics.data.map((track) => (
            <li
              key={track.id}
              className="flex items-center gap-3 rounded-lg border border-gray-500/20 p-3"
            >
              {track.thumbnailUrl ? (
                <img
                  src={track.thumbnailUrl}
                  alt=""
                  className="h-12 w-12 rounded object-cover"
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded bg-gray-500/10">
                  🎵
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{track.name}</div>
                <div className="flex flex-wrap gap-1">
                  {track.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full border border-gray-500/30 px-2 py-0.5 text-xs text-gray-500 uppercase"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => addToQueue(track)}
                  aria-label={`Add ${track.name} to queue`}
                >
                  + Queue
                </Button>
                <Button onClick={() => playTrack(track)}>▶ Play</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
