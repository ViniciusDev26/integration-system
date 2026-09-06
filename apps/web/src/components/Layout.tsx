import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { Player } from "./player/Player";
import { Sidebar } from "./Sidebar";
import { Spinner } from "./ui/spinner";

/**
 * Protected app shell (ADR 0009/0010/0013): persistent sidebar nav + the
 * routed `<Outlet/>` + the persistent player, guarded by the global auth
 * store. Anonymous visitors are redirected to `/login`; the initial session
 * check shows a spinner.
 */
export function Layout() {
  const status = useAuthStore((s) => s.status);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto px-6 py-6 pb-28">
          <Outlet />
        </main>
      </div>
      <Player />
    </div>
  );
}
