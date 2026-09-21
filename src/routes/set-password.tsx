import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth/client";
import { NexusMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completeSchoolOwnerSetup,
  completeStaffInvite,
  getInviteByToken,
  getStaffInvite,
  linkOwnerMembership,
} from "@/lib/nexus/server";

export const Route = createFileRoute("/set-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
    staff_token: typeof search.staff_token === "string" ? search.staff_token : "",
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { token, staff_token } = Route.useSearch();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<{
    schoolName: string;
    ownerName: string | null;
    ownerEmail: string | null;
    isStaff?: boolean;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (staff_token) {
      getStaffInvite({ data: { token: staff_token } })
        .then((info) => {
          setInvite({
            schoolName: info.schoolName,
            ownerName: info.fullName,
            ownerEmail: info.email,
            isStaff: true,
          });
          setLoading(false);
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "Invalid staff invite");
          setLoading(false);
        });
      return;
    }
    if (!token) {
      setError("Missing invite token. Open the link from your invitation email.");
      setLoading(false);
      return;
    }
    getInviteByToken({ data: { token } })
      .then((info) => {
        setInvite({
          schoolName: info.schoolName,
          ownerName: info.ownerName,
          ownerEmail: info.ownerEmail,
        });
        setLoading(false);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Invalid invite link");
        setLoading(false);
      });
  }, [token, staff_token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (!invite?.ownerEmail) {
      setError("Invite is missing owner email");
      return;
    }

    setPending(true);
    try {
      if (staff_token && invite?.ownerEmail) {
        const { error: signUpError } = await authClient.signUp.email({
          email: invite.ownerEmail,
          password,
          name: invite.ownerName || invite.schoolName,
          callbackURL: "/app",
        });
        if (signUpError) {
          const { error: signInError } = await authClient.signIn.email({
            email: invite.ownerEmail,
            password,
            callbackURL: "/app",
          });
          if (signInError) {
            setError(signInError.message || "Could not create account");
            setPending(false);
            return;
          }
        }
        await completeStaffInvite({ data: { token: staff_token } });
        setDone(true);
        setTimeout(() => {
          window.location.href = "/app";
        }, 1000);
        return;
      }

      // 1. Mark invite as used on the server
      const result = await completeSchoolOwnerSetup({
        data: {
          token,
          password,
          name: invite.ownerName ?? undefined,
        },
      });

      // 2. Create the Better Auth account (or sign in if already exists)
      const { error: signUpError } = await authClient.signUp.email({
        email: result.ownerEmail,
        password,
        name: result.ownerName || result.schoolName,
        callbackURL: "/app",
      });

      if (signUpError) {
        // Account may already exist — try sign-in instead
        const { error: signInError } = await authClient.signIn.email({
          email: result.ownerEmail,
          password,
          callbackURL: "/app",
        });
        if (signInError) {
          // Password might not match existing account; tell user to sign in manually
          setError(
            "Account exists but password could not be set automatically. Please use the login page or contact support.",
          );
          setPending(false);
          return;
        }
      }

      setDone(true);
      try {
        await linkOwnerMembership({ data: { schoolId: result.schoolId } });
      } catch {
        /* membership link best-effort */
      }
      setTimeout(() => {
        window.location.href = "/app/setup";
      }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setPending(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-ink px-4 py-12 text-foam">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <NexusMark className="size-12" />
          <h1 className="font-display text-2xl tracking-tight">Set your password</h1>
          <p className="text-sm text-mist">
            {loading
              ? "Validating invite…"
              : invite
                ? `Welcome to NEXUS. You are setting up the owner account for ${invite.schoolName}.`
                : "Invite validation"}
          </p>
        </div>

        {loading && (
          <div className="rounded-xl border border-white/10 bg-ink-3 p-6 text-center text-sm text-mist">
            Checking invite…
          </div>
        )}

        {!loading && error && !invite && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-200">{error}</p>
            <Link to="/login" className="mt-4 inline-block text-sm text-foam underline">
              Go to login
            </Link>
          </div>
        )}

        {!loading && invite && !done && (
          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-white/10 bg-ink-3 p-6"
          >
            <div className="space-y-1 text-sm">
              <p>
                <span className="text-mist">School</span>
                <br />
                <span className="font-medium">{invite.schoolName}</span>
              </p>
              <p>
                <span className="text-mist">Owner email</span>
                <br />
                <span className="font-medium">{invite.ownerEmail}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-mist">
                New password
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="border-white/10 bg-ink text-foam"
                placeholder="At least 8 characters"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm" className="text-mist">
                Confirm password
              </Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="border-white/10 bg-ink text-foam"
              />
            </div>

            {error && (
              <p className="text-sm text-red-300">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full bg-foam text-ink hover:bg-foam/90"
              disabled={pending}
            >
              {pending ? "Setting password…" : "Set password & continue"}
            </Button>
          </form>
        )}

        {done && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
            <p className="font-medium text-emerald-200">Password set successfully</p>
            <p className="mt-1 text-sm text-mist">Taking you to your school workspace…</p>
          </div>
        )}
      </div>
    </div>
  );
}
