import { useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AUTH_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { NexusMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/login")({ component: Login });

function EmailPasswordForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
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
      const { error: authError } =
        mode === "sign-in"
          ? await authClient.signIn.email({ email, password, callbackURL: "/app" })
          : await authClient.signUp.email({ email, password, name, callbackURL: "/app" });
      if (authError) {
        setError(authError.message ?? "Something went wrong. Try again.");
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
      {mode === "sign-up" && (
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-mist">
            Name
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
        {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        className="w-full text-center text-xs text-mist underline-offset-4 hover:underline"
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </form>
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) {
    return (
      <main className="grid min-h-dvh place-items-center bg-ink">
        <Skeleton className="h-48 w-80 bg-ink-3" />
      </main>
    );
  }
  if (user) return <Navigate to="/app" />;

  return (
    <main className="relative min-h-dvh bg-ink text-foam">
      <div className="ledger-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
        <Link to="/" className="mb-10 flex items-center gap-2 text-foam">
          <NexusMark className="text-foam" />
          <span className="font-display text-2xl font-medium tracking-tight">NEXUS</span>
        </Link>
        <h1 className="font-display text-4xl font-medium tracking-tight">Enter the desk.</h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          School owners, teachers and platform operators sign in here. Parents use the same
          workspace after you switch role inside.
        </p>
        {authEnabled ? (
          <div className="mt-8 space-y-4">
            <EmailPasswordForm />
            {AUTH_PROVIDERS.length > 0 && (
              <>
                <div className="flex items-center gap-3 text-xs text-mist">
                  <div className="h-px flex-1 bg-white/10" />
                  or
                  <div className="h-px flex-1 bg-white/10" />
                </div>
                <div className="space-y-3">
                  {AUTH_PROVIDERS.map((p) => (
                    <Button
                      key={p.id}
                      type="button"
                      variant="secondary"
                      className="h-11 w-full bg-ink-3 text-foam hover:bg-ink-3/80"
                      onClick={() => signIn(p.id, { callbackURL: "/app" })}
                    >
                      Continue with {p.label}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <p className="mt-8 text-sm text-mist">Sign-in is disabled.</p>
        )}
        <p className="mt-8 text-xs text-mist">
          Opening the workspace provisions Sunrise Academy with live Term 2 records for this
          account only.
        </p>
      </div>
    </main>
  );
}
