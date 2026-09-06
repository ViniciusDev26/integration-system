import { ListMusic } from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Card } from "../components/ui/card";

export function PlaylistsPage() {
  const playlists = trpc.playlists.list.useQuery();

  if (playlists.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (playlists.error || playlists.data === undefined) {
    return <p className="text-destructive">Failed to load playlists.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Your playlists</h1>
        <Link
          to="/playlists/new"
          className="text-sm text-primary hover:underline"
        >
          New playlist
        </Link>
      </div>

      {playlists.data.length === 0 ? (
        <p className="text-muted-foreground">No playlists yet.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {playlists.data.map((playlist) => (
            <Link key={playlist.id} to={`/playlists/${playlist.id}`}>
              <Card className="gap-3 p-4 hover:bg-secondary">
                <div className="grid aspect-square place-items-center rounded bg-gradient-to-br from-secondary to-muted">
                  <ListMusic className="h-8 w-8 text-muted-foreground" />
                </div>
                <span className="truncate font-semibold">{playlist.name}</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
