import { useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { trpc } from "../api/trpc";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";

/** What went wrong, in words the person who clicked a link can act on. */
function explain(
  code: string | undefined,
  message: string | undefined,
): string {
  if (message === "invite_expired") {
    return "This invite link has expired. Ask for a new one.";
  }
  if (message === "invite_revoked") {
    return "This invite link was revoked and no longer works.";
  }
  if (code === "NOT_FOUND") {
    return "This invite link is not valid.";
  }
  return "Something went wrong opening this invite.";
}

/**
 * Lands someone on `/invite/:token`, redeems it, and sends them to the
 * playlist they were invited into (api ADR 0040). The route sits inside the
 * authenticated layout, so an anonymous visitor signs in first and arrives
 * here afterwards.
 */
export function JoinPlaylistPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const redeem = trpc.invites.redeem.useMutation();
  const utils = trpc.useUtils();
  // Redeeming is a mutation with a side effect, and React runs effects twice in
  // development — guard so a single link is not redeemed twice.
  const attempted = useRef(false);

  useEffect(() => {
    if (token === undefined || attempted.current) {
      return;
    }
    attempted.current = true;

    redeem.mutate(
      { token },
      {
        onSuccess: ({ resourceId }) => {
          // The playlist now belongs in this user's list.
          utils.playlists.list.invalidate();
          navigate(`/playlists/${resourceId}`, { replace: true });
        },
      },
    );
  }, [token, redeem.mutate, utils, navigate]);

  if (redeem.isError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Invite not accepted</h1>
        <p className="text-destructive">
          {explain(redeem.error.data?.code, redeem.error.message)}
        </p>
        <Button asChild variant="secondary">
          <Link to="/playlists">Back to your playlists</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-muted-foreground">
      <Spinner />
      Joining the playlist…
    </div>
  );
}
