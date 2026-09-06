import { Link, Outlet, useNavigate } from "react-router-dom";
import { trpc } from "../api/trpc";
import { useAuth } from "../hooks/useAuth";
import { Button } from "./ui/button";

/**
 * App shell (ADR 0009): persistent header/nav + the routed `<Outlet/>`. This is
 * where the persistent audio player will live so it survives navigation.
 */
export function Layout() {
  const navigate = useNavigate();
  const { user, isSignedIn } = useAuth();
  const utils = trpc.useUtils();

  const startLogin = trpc.auth.startLogin.useMutation({
    onSuccess: ({ url }) => {
      window.location.href = url;
    },
  });
  const logout = trpc.auth.logout.useMutation({
    onSuccess: async () => {
      await utils.invalidate();
      navigate("/");
    },
  });

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-500/20 px-6 py-3">
        <nav className="flex items-center gap-4">
          <Link to="/" className="font-bold">
            🎧 Spotifake
          </Link>
          {isSignedIn && (
            <>
              <Link to="/musics" className="text-sm hover:underline">
                Tracks
              </Link>
              <Link to="/playlists" className="text-sm hover:underline">
                Playlists
              </Link>
            </>
          )}
        </nav>
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <>
              <span className="text-sm text-gray-500">
                {user?.name ?? user?.email}
              </span>
              <Button
                variant="secondary"
                onClick={() => logout.mutate()}
                disabled={logout.isPending}
              >
                Log out
              </Button>
            </>
          ) : (
            <Button
              onClick={() => startLogin.mutate()}
              disabled={startLogin.isPending}
            >
              Sign in with GitHub
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
