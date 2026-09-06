import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";

/**
 * App shell (ADR 0009): persistent header/nav + the routed `<Outlet/>`. Auth is
 * read from the global store (ADR 0010); this shell will also host the player.
 */
export function Layout() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);

  const isSignedIn = status === "authenticated";
  const isAuthenticating = status === "authenticating";

  async function handleLogout() {
    await logout();
    navigate("/");
  }

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
              <Button variant="secondary" onClick={handleLogout}>
                Log out
              </Button>
            </>
          ) : (
            <Button onClick={() => login()} disabled={isAuthenticating}>
              {isAuthenticating && <Spinner />}
              {isAuthenticating ? "Signing in…" : "Sign in with GitHub"}
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
