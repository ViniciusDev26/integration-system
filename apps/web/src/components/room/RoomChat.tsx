import { Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "../../api/trpc";
import { useAuthStore } from "../../store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";

/** Mirrors the API's message bound (api ADR 0044). */
const MESSAGE_MAX_LENGTH = 2000;

interface ChatMessage {
  id: string;
  userId: string;
  authorName: string | null;
  authorImageUrl: string | null;
  body: string;
  createdAt: Date;
}

function initialsOf(name: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length === 0 ? "?" : trimmed.slice(0, 1).toUpperCase();
}

function timeOf(at: Date): string {
  return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Chat inside a room (api ADR 0044).
 *
 * History comes from a query and live messages from a subscription. The two
 * **overlap on purpose**: on reconnect the server replays from the last id this
 * client saw, and a message can legitimately arrive by both paths. Merging by
 * id is what makes that safe — and it is why losing a message is impossible
 * rather than merely unlikely.
 */
export function RoomChat({ roomId }: { roomId: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const history = trpc.rooms.messages.useQuery({ roomId });
  const [live, setLive] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  trpc.rooms.onMessage.useSubscription(
    { roomId },
    {
      onData: (message) => {
        // tRPC unwraps `tracked()` on the wire into `{ id, data }` and records
        // the id, so a reconnect resumes from here automatically.
        setLive((current) =>
          current.some((existing) => existing.id === message.data.id)
            ? current
            : [...current, message.data],
        );
      },
    },
  );

  const sendMessage = trpc.rooms.sendMessage.useMutation({
    onSuccess: () => setDraft(""),
  });

  // One list, deduplicated by id, in id order — which is creation order,
  // because the ids are UUIDv7 (api ADR 0044).
  const messages = useMemo(() => {
    const byId = new Map<string, ChatMessage>();
    for (const message of [...(history.data ?? []), ...live]) {
      byId.set(message.id, message);
    }
    return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : 1));
  }, [history.data, live]);

  // Follow the conversation as it grows. `messages` is read here rather than
  // just listed, so the dependency is one the body actually has.
  useEffect(() => {
    if (messages.length === 0) {
      return;
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const trimmed = draft.trim();

  return (
    <section className="flex h-80 flex-col rounded-lg border border-border">
      <h2 className="border-b border-border px-4 py-2 text-sm font-semibold">
        Chat
      </h2>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {history.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing said yet. Say something while the music plays.
          </p>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="flex items-start gap-2">
              <Avatar size="sm">
                {message.authorImageUrl !== null && (
                  <AvatarImage src={message.authorImageUrl} alt="" />
                )}
                <AvatarFallback>
                  {initialsOf(message.authorName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">
                    {message.userId === currentUser?.id
                      ? "You"
                      : (message.authorName ?? "Unnamed")}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {timeOf(message.createdAt)}
                  </span>
                </div>
                <p className="text-sm break-words whitespace-pre-wrap">
                  {message.body}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        className="flex gap-2 border-t border-border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (trimmed.length > 0) {
            sendMessage.mutate({ roomId, body: trimmed });
          }
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          placeholder="Message the room…"
          maxLength={MESSAGE_MAX_LENGTH}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          type="submit"
          size="icon"
          disabled={trimmed.length === 0 || sendMessage.isPending}
          aria-label="Send message"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </section>
  );
}
