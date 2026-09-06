import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";

export function MusicsPage() {
  const musics = trpc.musics.list.useQuery();

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
              className="rounded-lg border border-gray-500/20 p-3"
            >
              <div className="flex items-center gap-3">
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
                <div className="min-w-0">
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
              </div>
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
    </div>
  );
}
