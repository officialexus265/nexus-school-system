import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AUTH_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { NexusMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { bootstrapPlatformOwner } from "@/lib/nexus/server";

export const Route = createFileRoute("/login")({ component: Login });

function EmailPasswordForm() {
  const [mode, setMode] = useState<"sign-in" | "bootstrap">("sign-in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "bootstrap") {
        // Create account then promote to platform owner (only works if none exist)
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: name || "Platform Owner",
          callbackURL: "/app/platform",
        });
        if (signUpError) {
          setError(signUpError.message ?? "Could not create account");
          setPending(false);
          return;
        }
        try {
          await bootstrapPlatformOwner({ data: { email } });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Account created but could not become platform owner. Sign in and contact support.",
          );
          setPending(false);
          return;
        }
        window.location.href = "/app/platform";
        return;
      }

      const { error: authError } = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/app",
      });
      if (authError) {
        setError(authError.message ?? "Invalid email or password");
        setPending(false);
        return;
      }
      window.location.href = "/app";
    } catch {
      setError("Something went wrong. Try again.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {mode === "bootstrap" && (
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-mist">
            Your name
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="border-white/10 bg-ink-3 text-foam"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-mist">
          Email
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border-white/10 bg-ink-3 text-foam"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password" className="text-mist">
          Password
        </Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          className="border-white/10 bg-ink-3 text-foam"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <Button
        type="submit"
        disabled={pending}
        className="h-11 w-full bg-foam text-ink hover:bg-foam/90"
      >
        {pending
          ? "Please wait…"
          : mode === "bootstrap"
            ? "Create platform owner"
            : "Sign in"}
      </Button>
      <p className="text-center text-xs text-mist">
        School owners do not self-register. You open their accounts from the Platform dashboard;
        they set a password via the invite email link.
      </p>
      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "bootstrap" : "sign-in")}
        className="w-full text-center text-xs text-mist underline-offset-4 hover:underline"
      >
        {mode === "sign-in"
          ? "First time? Create the platform owner account"
          : "Back to sign in"}
      </button>
    </form>
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <Skeleton className="mx-auto mt-24 h-80 max-w-md" />;
  if (user) return <Navigate to="/app" />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-4 py-12 text-foam">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <NexusMark className="size-12" />
          <h1 className="font-display text-2xl tracking-tight">NEXUS</h1>
          <p className="text-sm text-mist">
            Platform operators and invited school staff sign in here. Parents use the school
            app, not this page.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-ink-2 p-6 shadow-xl">
          {authEnabled ? (
            <>
              {AUTH_PROVIDERS.length > 0 && (
                <div className="mb-4 space-y-2">
                  {AUTH_PROVIDERS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="outline"
                      className="w-full border-white/10"
                      onClick={() => void signIn(p.id, "/app")}
                    >
                      Continue with {p.label}
                    </Button>
                  ))}
                </div>
              )}
              <EmailPasswordForm />
            </>
          ) : (
            <p className="text-sm text-mist">
              Auth is disabled (`VITE_AUTH_ENABLED=false`). Set it to true and use Better Auth
              credentials.
            </p>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-mist">
          <Link to="/" className="underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
