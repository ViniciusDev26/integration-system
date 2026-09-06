import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

const linkClass =
  "inline-flex items-center justify-center rounded-md bg-[#1db954] px-4 py-2 text-sm font-semibold text-white hover:opacity-90";

export function HomePage() {
  const { isSignedIn, isLoading, user } = useAuth();

  if (isLoading) {
    return <p className="text-gray-500">Loading…</p>;
  }

  if (!isSignedIn) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">🎧 Spotifake</h1>
        <p className="text-gray-500">
          Sign in with GitHub (top right) to upload and browse music.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {user?.imageUrl && (
          <img
            src={user.imageUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        )}
        <h1 className="text-2xl font-bold">
          Welcome, {user?.name ?? user?.email}
        </h1>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link className={linkClass} to="/musics">
          Browse tracks
        </Link>
        <Link className={linkClass} to="/musics/new">
          Upload a track
        </Link>
        <Link className={linkClass} to="/playlists">
          Your playlists
        </Link>
      </div>
    </div>
  );
}
