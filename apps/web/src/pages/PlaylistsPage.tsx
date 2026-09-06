import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";

export function PlaylistsPage() {
  const playlists = trpc.playlists.list.useQuery();

  if (playlists.isLoading) {
    return <p className="text-gray-500">Loading…</p>;
  }
  if (playlists.error || playlists.data === undefined) {
    return <p className="text-red-500">Failed to load playlists.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your playlists</h1>
        <Link
          to="/playlists/new"
          className="text-sm text-[#1db954] hover:underline"
        >
          New playlist
        </Link>
      </div>

      {playlists.data.length === 0 ? (
        <p className="text-gray-500">No playlists yet.</p>
      ) : (
        <ul className="space-y-2">
          {playlists.data.map((playlist) => (
            <li
              key={playlist.id}
              className="rounded-lg border border-gray-500/20 p-3"
            >
              <Link
                to={`/playlists/${playlist.id}`}
                className="font-semibold hover:text-[#1db954]"
              >
                {playlist.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
