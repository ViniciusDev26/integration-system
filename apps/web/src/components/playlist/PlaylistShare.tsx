import { Check, Copy, Link2, UserPlus, X } from "lucide-react";
import { useState } from "react";
import { trpc } from "../../api/trpc";
import { useAuthStore } from "../../store/auth";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

/** Turns a token into the link a person actually pastes to someone else. */
function inviteUrl(token: string): string {
  return `${window.location.origin}/invite/${token}`;
}

function initialsOf(name: string | null): string {
  const trimmed = (name ?? "").trim();
  return trimmed.length === 0 ? "?" : trimmed.slice(0, 1).toUpperCase();
}

/**
 * Who belongs to a playlist, and — for its owner — the links that let more
 * people in (api ADR 0040). Only the owner may invite, so everyone else sees
 * the member list alone.
 */
export function PlaylistShare({ playlistId }: { playlistId: string }) {
  const currentUser = useAuthStore((s) => s.user);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const members = trpc.playlists.members.useQuery({ playlistId });
  const isOwner =
    members.data?.some(
      (member) => member.userId === currentUser?.id && member.type === "OWNER",
    ) ?? false;

  const inviteList = trpc.invites.list.useQuery(
    { resourceType: "PLAYLIST", resourceId: playlistId },
    { enabled: isOwner },
  );

  const createInvite = trpc.invites.create.useMutation({
    onSuccess: () => inviteList.refetch(),
  });
  const revokeInvite = trpc.invites.revoke.useMutation({
    onSuccess: () => inviteList.refetch(),
  });

  async function copy(token: string) {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken(null), 2000);
    } catch {
      // Clipboard can be blocked (no permission, insecure context). The link is
      // on screen and selectable, so this is not worth interrupting anyone over.
    }
  }

  if (members.isLoading) {
    return null;
  }

  const live = (inviteList.data ?? []).filter(
    (invite) =>
      invite.revokedAt === null && new Date(invite.expiresAt) > new Date(),
  );

  return (
    <section className="space-y-4 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Members
          <span className="pl-2 font-normal text-muted-foreground">
            {members.data?.length ?? 0}
          </span>
        </h2>
        {isOwner && (
          <Button
            variant="secondary"
            size="sm"
            disabled={createInvite.isPending}
            onClick={() =>
              createInvite.mutate({
                resourceType: "PLAYLIST",
                resourceId: playlistId,
              })
            }
          >
            <UserPlus className="h-4 w-4" />
            Create invite link
          </Button>
        )}
      </div>

      <ul className="flex flex-wrap gap-3">
        {(members.data ?? []).map((member) => (
          <li key={member.userId} className="flex items-center gap-2">
            <Avatar size="sm">
              {member.imageUrl !== null && (
                <AvatarImage src={member.imageUrl} alt="" />
              )}
              <AvatarFallback>{initialsOf(member.name)}</AvatarFallback>
            </Avatar>
            <span className="text-sm">
              {member.name ?? "Unnamed"}
              {member.userId === currentUser?.id && " (you)"}
            </span>
            {member.type === "OWNER" && (
              <Badge variant="secondary">owner</Badge>
            )}
          </li>
        ))}
      </ul>

      {isOwner && live.length > 0 && (
        <div className="space-y-2 border-t border-border pt-3">
          <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Active links
          </h3>
          <ul className="space-y-2">
            {live.map((invite) => (
              <li key={invite.id} className="flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <code className="min-w-0 flex-1 truncate rounded bg-secondary px-2 py-1 text-xs">
                  {inviteUrl(invite.token)}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copy(invite.token)}
                  aria-label="Copy invite link"
                >
                  {copiedToken === invite.token ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={revokeInvite.isPending}
                  onClick={() => revokeInvite.mutate({ inviteId: invite.id })}
                  aria-label="Revoke invite link"
                >
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Anyone signed in who opens a link joins this playlist. Revoke one to
            stop it working.
          </p>
        </div>
      )}
    </section>
  );
}
