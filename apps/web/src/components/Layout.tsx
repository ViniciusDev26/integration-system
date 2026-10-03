import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { MobileNav } from "./MobileNav";
import { Player } from "./player/Player";
import { Sidebar } from "./Sidebar";
import { Spinner } from "./ui/spinner";

/**
 * Protected app shell (ADR 0009/0010/0013): navigation + the routed
 * `<Outlet/>` + the persistent player, guarded by the global auth store.
 *
 * Navigation is the sidebar from `md` up and a top bar with a drawer below it
 * (ADR 0016). `min-w-0` on the content column is what stops a wide child —
 * a long track name, a code block — from pushing the page sideways. Anonymous
 * visitors are redirected to `/login`; the initial session check shows a
 * spinner.
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
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav />
          {/* The bottom padding clears the fixed player, which is two rows tall
              below `sm` (ADR 0016) and one above it. */}
          <main className="flex-1 overflow-y-auto px-4 py-5 pb-40 sm:px-6 sm:py-6 sm:pb-32">
            <Outlet />
          </main>
        </div>
      </div>
      <Player />
    </div>
  );
}
