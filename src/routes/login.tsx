import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { AUTH_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { NexusMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  bootstrapPlatformOwner,
  platformBootstrapStatus,
  checkUserRequires2fa,
  verifyTotpLogin,
} from "@/lib/nexus/server";

export const Route = createFileRoute("/login")({ component: Login });

function EmailPasswordForm({ canCreateFirstOwner }: { canCreateFirstOwner: boolean }) {
  const [mode, setMode] = useState<"sign-in" | "bootstrap">(
    canCreateFirstOwner ? "bootstrap" : "sign-in",
  );
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [totpStep, setTotpStep] = useState(false);
  const [totpCode, setTotpCode] = useState("");


  useEffect(() => {
    if (!canCreateFirstOwner && mode === "bootstrap") setMode("sign-in");
  }, [canCreateFirstOwner, mode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "bootstrap" && canCreateFirstOwner) {
        const { error: signUpError } = await authClient.signUp.email({
          email,
          password,
          name: name || "Platform Owner",
          callbackURL: "/app/platform",
        });

        if (signUpError) {
          const { error: signInError } = await authClient.signIn.email({
            email,
            password,
            callbackURL: "/app/platform",
          });
          if (signInError) {
            setError(
              "This email is already registered. Use Sign in with the same password, " +
                "then Claim super admin on Platform if needed.",
            );
            setPending(false);
            return;
          }
        } else {
          await authClient.signIn.email({
            email,
            password,
            callbackURL: "/app/platform",
          });
        }

        try {
          await bootstrapPlatformOwner({ data: { email } });
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "Signed in but not promoted. Open Platform → Claim super admin.",
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
      if (canCreateFirstOwner) {
        try {
          await bootstrapPlatformOwner({ data: { email } });
        } catch {
          /* ignore */
        }
      }
      try {
        const need = await checkUserRequires2fa({ data: { email } });
        if (need.required) {
          setTotpStep(true);
          setPending(false);
          return;
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "2FA check failed");
        setPending(false);
        return;
      }
      window.location.href = "/app";
    } catch {
      setError("Something went wrong. Try again.");
      setPending(false);
    }
  }

  async function submitTotp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await verifyTotpLogin({ data: { code: totpCode } });
      window.location.href = "/app";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
      setPending(false);
    }
  }

  if (totpStep) {
    return (
      <form onSubmit={submitTotp} className="space-y-3">
        <p className="text-sm text-mist">
          Enter the 6-digit code from your authenticator app (or a backup code).
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="totp" className="text-mist">
            Authentication code
          </Label>
          <Input
            id="totp"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            required
            className="border-white/10 bg-ink-3 text-center text-lg tracking-[0.3em] text-foam"
            placeholder="000000"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" disabled={pending} className="h-11 w-full bg-foam text-ink hover:bg-foam/90">
          {pending ? "Verifying…" : "Verify and continue"}
        </Button>
        <button
          type="button"
          className="w-full text-center text-xs text-mist underline-offset-4 hover:underline"
          onClick={() => {
            setTotpStep(false);
            setTotpCode("");
            setError(null);
          }}
        >
          Back
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {mode === "bootstrap" && canCreateFirstOwner && (
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
          : mode === "bootstrap" && canCreateFirstOwner
            ? "Create super admin (platform owner)"
            : "Sign in"}
      </Button>
      <p className="text-center text-xs text-mist">
        School staff sign in here after you invite them. Parents use the school parent app / PWA.
      </p>
      {canCreateFirstOwner ? (
        <button
          type="button"
          onClick={() => setMode(mode === "sign-in" ? "bootstrap" : "sign-in")}
          className="w-full text-center text-xs text-mist underline-offset-4 hover:underline"
        >
          {mode === "sign-in"
            ? "First time? Create the platform super admin"
            : "Back to sign in"}
        </button>
      ) : (
        <div className="space-y-1 pt-1 text-center text-xs text-mist">
          <p>
            Do you want a school account? Contact the{" "}
            <a
              href="tel:+265980697476"
              className="font-medium text-foam underline-offset-4 hover:underline"
            >
              system owner
            </a>
          </p>
          <p>
            <a
              href="tel:+265980697476"
              className="text-sm font-medium tracking-wide text-foam underline-offset-4 hover:underline"
            >
              0980697476
            </a>
          </p>
        </div>
      )}
    </form>
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [status, setStatus] = useState<{
    canCreateFirstOwner: boolean;
  } | null>(null);

  useEffect(() => {
    void platformBootstrapStatus()
      .then((s) => setStatus({ canCreateFirstOwner: s.canCreateFirstOwner }))
      .catch(() => setStatus({ canCreateFirstOwner: true }));
  }, []);

  if (isPending || !status) return <Skeleton className="mx-auto mt-24 h-80 max-w-md" />;
  if (user) return <Navigate to="/app" />;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-4 py-12 text-foam">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <NexusMark className="size-12" />
          <h1 className="font-display text-2xl tracking-tight">NEXUS</h1>
          <p className="text-sm text-mist">
            Platform operators and invited school staff sign in here. Parents use the school
            parent app, not this page.
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
              <EmailPasswordForm canCreateFirstOwner={status.canCreateFirstOwner} />
            </>
          ) : (
            <p className="text-sm text-mist">Auth is disabled. Set VITE_AUTH_ENABLED=true</p>
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
