import { Home, ListMusic, LogOut, Music } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuthStore } from "../store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: Home, end: true },
  { to: "/musics", label: "Tracks", icon: Music, end: false },
  { to: "/playlists", label: "Playlists", icon: ListMusic, end: false },
] as const;

/** Persistent left navigation (ADR 0013) — brand, primary nav, user menu. */
export function Sidebar() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-card">
      <div className="px-6 py-5">
        <NavLink to="/" className="text-lg font-bold">
          🎧 Spotifake
        </NavLink>
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition ${
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-secondary">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user?.imageUrl ?? undefined} alt="" />
              <AvatarFallback>
                {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm text-foreground">
              {user?.name ?? user?.email}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top">
            <DropdownMenuItem onSelect={() => logout()}>
              <LogOut />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
