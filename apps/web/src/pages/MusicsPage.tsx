import { ListPlus, Music, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { usePlayerStore } from "../store/player";

export function MusicsPage() {
  const musics = trpc.musics.list.useQuery();
  const playTrack = usePlayerStore((s) => s.playTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const queue = usePlayerStore((s) => s.queue);

  if (musics.isLoading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (musics.error || musics.data === undefined) {
    return <p className="text-destructive">Failed to load tracks.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">All tracks</h1>
        <Link to="/musics/new" className="text-sm text-primary hover:underline">
          Upload a track
        </Link>
      </div>

      {musics.data.length === 0 ? (
        <p className="text-muted-foreground">No tracks yet.</p>
      ) : (
        <ul className="space-y-1">
          {musics.data.map((track) => {
            const queued = queue.some((t) => t.id === track.id);
            return (
              <li
                key={track.id}
                className="group flex items-center gap-3 rounded-md p-2 hover:bg-secondary"
              >
                <button
                  type="button"
                  onClick={() => playTrack(track)}
                  aria-label={`Play ${track.name}`}
                  className="relative shrink-0"
                >
                  <Avatar className="h-12 w-12 rounded">
                    <AvatarImage
                      src={track.thumbnailUrl ?? undefined}
                      alt=""
                      className="rounded"
                    />
                    <AvatarFallback className="rounded bg-muted">
                      <Music className="h-5 w-5 text-muted-foreground" />
                    </AvatarFallback>
                  </Avatar>
                  <span className="absolute inset-0 hidden place-items-center rounded bg-background/60 group-hover:grid">
                    <Play className="h-5 w-5" fill="currentColor" />
                  </span>
                </button>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{track.name}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {track.genres.map((genre) => (
                      <Badge key={genre} variant="outline">
                        {genre}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => addToQueue(track)}
                    disabled={queued}
                    aria-label={`Add ${track.name} to queue`}
                  >
                    <ListPlus className="h-4 w-4" />
                    {queued ? "In queue" : "Queue"}
                  </Button>
                  <Button onClick={() => playTrack(track)}>
                    <Play className="h-4 w-4" fill="currentColor" />
                    Play
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
