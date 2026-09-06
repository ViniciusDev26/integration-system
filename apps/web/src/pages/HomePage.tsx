import { ListMusic, ListPlus, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Card } from "../components/ui/card";
import { useAuthStore } from "../store/auth";

const QUICK_LINKS = [
  { to: "/musics", label: "Browse tracks", icon: ListMusic },
  { to: "/musics/new", label: "Upload a track", icon: Upload },
  { to: "/playlists", label: "Your playlists", icon: ListPlus },
] as const;

export function HomePage() {
  // Rendered only inside the protected layout, so the user is authenticated.
  const user = useAuthStore((s) => s.user);
  const playlists = trpc.playlists.list.useQuery();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user?.imageUrl ?? undefined} alt="" />
          <AvatarFallback>
            {(user?.name ?? user?.email ?? "?").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <h1 className="text-2xl font-bold">
          Welcome, {user?.name ?? user?.email}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to}>
            <Card className="flex flex-row items-center gap-3 p-4 hover:bg-secondary">
              <Icon className="h-5 w-5 text-primary" />
              <span className="font-semibold">{label}</span>
            </Card>
          </Link>
        ))}
      </div>

      {playlists.data && playlists.data.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Your playlists</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {playlists.data.slice(0, 5).map((playlist) => (
              <Link key={playlist.id} to={`/playlists/${playlist.id}`}>
                <Card className="gap-3 p-4 hover:bg-secondary">
                  <div className="grid aspect-square place-items-center rounded bg-gradient-to-br from-secondary to-muted">
                    <ListMusic className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <span className="truncate font-semibold">
                    {playlist.name}
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
