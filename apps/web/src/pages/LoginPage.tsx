import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { useAuthStore } from "../store/auth";

export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="h-6 w-6 text-gray-500" />
      </div>
    );
  }
  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const isAuthenticating = status === "authenticating";

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-gray-500/20 p-8 text-center">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">🎧 Spotifake</h1>
          <p className="text-sm text-gray-500">
            Sign in to upload and browse music.
          </p>
        </div>
        <Button
          className="w-full"
          onClick={() => login()}
          disabled={isAuthenticating}
        >
          {isAuthenticating && <Spinner />}
          {isAuthenticating ? "Signing in…" : "Sign in with GitHub"}
        </Button>
      </div>
    </div>
  );
}
