import { TRPCClientError } from "@trpc/client";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { useAuthStore } from "../store/auth";

type Mode = "login" | "register";

/** The API's own words, turned into something worth reading. */
function explain(error: unknown, mode: Mode): string {
  if (error instanceof TRPCClientError) {
    if (error.message === "invalid_credentials") {
      return "That email and password do not match an account.";
    }
    if (error.message === "email_in_use") {
      return "An account already uses that email. Try signing in instead.";
    }
    if (error.data?.code === "BAD_REQUEST") {
      return mode === "register"
        ? "Check the email, and use a password of at least 8 characters."
        : "Check the email and password.";
    }
  }
  return "Something went wrong. Please try again.";
}

export function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const register = useAuthStore((s) => s.register);

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Spinner className="h-6 w-6 text-muted-foreground" />
      </div>
    );
  }
  if (status === "authenticated") {
    return <Navigate to="/" replace />;
  }

  const isAuthenticating = status === "authenticating";
  const registering = mode === "register";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      if (registering) {
        await register(email, password, name.trim() === "" ? null : name);
      } else {
        await loginWithPassword(email, password);
      }
    } catch (err) {
      setError(explain(err, mode));
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4 sm:px-6">
      <div className="w-full max-w-sm space-y-6 rounded-xl bg-card p-6 sm:p-8">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-bold">🎧 Spotifake</h1>
          <p className="text-sm text-muted-foreground">
            {registering
              ? "Create an account to upload and listen."
              : "Sign in to upload and browse music."}
          </p>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {registering && (
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted-foreground">
                Name (optional)
              </span>
              <input
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
          )}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Email
            </span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-muted-foreground">
              Password
            </span>
            <input
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              type="password"
              required
              minLength={8}
              autoComplete={registering ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {registering && (
              <span className="text-xs text-muted-foreground">
                At least 8 characters. Length is all that is asked of it.
              </span>
            )}
          </label>

          {error !== null && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isAuthenticating}>
            {isAuthenticating && <Spinner />}
            {registering ? "Create account" : "Sign in"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {registering ? "Already have an account?" : "No account yet?"}{" "}
          <button
            type="button"
            className="font-semibold text-foreground hover:underline"
            onClick={() => {
              setMode(registering ? "login" : "register");
              setError(null);
            }}
          >
            {registering ? "Sign in" : "Create one"}
          </button>
        </p>

        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="secondary"
          className="w-full"
          onClick={() => login()}
          disabled={isAuthenticating}
        >
          Continue with GitHub
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Signing in with GitHub at an address you already registered joins the
          same account.
        </p>
      </div>
    </div>
  );
}
