import { Radio } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Button } from "../components/ui/button";

/** Listening rooms the signed-in user belongs to, and a way to open a new one. */
export function RoomsPage() {
  const utils = trpc.useUtils();
  const rooms = trpc.rooms.list.useQuery();
  const [name, setName] = useState("");

  const createRoom = trpc.rooms.create.useMutation({
    onSuccess: () => {
      setName("");
      utils.rooms.list.invalidate();
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rooms</h1>
        <p className="text-sm text-muted-foreground">
          Listen together — everyone in a room hears the same moment of the same
          track.
        </p>
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length > 0) {
            createRoom.mutate({ name: name.trim() });
          }
        }}
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-sm font-semibold text-muted-foreground">
            New room
          </span>
          <input
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Friday night"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <Button
          type="submit"
          disabled={name.trim().length === 0 || createRoom.isPending}
        >
          Create
        </Button>
      </form>

      {rooms.isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : (rooms.data ?? []).length === 0 ? (
        <p className="text-muted-foreground">
          No rooms yet. Create one, then share its invite link.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {(rooms.data ?? []).map((room) => (
            <li key={room.id}>
              <Link
                to={`/rooms/${room.id}`}
                className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-secondary"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded bg-gradient-to-br from-secondary to-muted">
                  <Radio className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold">{room.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {room.isPlaying ? "Playing now" : "Paused"}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
