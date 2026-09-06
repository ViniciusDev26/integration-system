import { Link, Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

/**
 * Protected app shell (ADR 0009/0010): persistent header/nav + the routed
 * `<Outlet/>`, guarded by the global auth store. Anonymous visitors are redirected
 * to `/login`; the initial session check shows a spinner. This shell will also
 * host the persistent player.
 */
export function Layout() {
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const logout = useAuthStore((s) => s.logout);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-6 w-6 text-gray-500" />
      </div>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-500/20 px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link to="/" className="font-bold">
            🎧 Spotifake
          </Link>
          <Link to="/musics" className="text-sm hover:underline">
            Tracks
          </Link>
          <Link to="/playlists" className="text-sm hover:underline">
            Playlists
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          {user?.imageUrl && (
            <img
              src={user.imageUrl}
              alt=""
              className="h-7 w-7 rounded-full object-cover"
            />
          )}
          <span className="text-sm text-gray-500">
            {user?.name ?? user?.email}
          </span>
          <Button variant="secondary" onClick={() => logout()}>
            Log out
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
