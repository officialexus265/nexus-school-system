import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  getParentPortal,
  getParentPortalSession,
  getParentAppManifest,
  listParentMessages,
  requestParentChildLink,
  requestParentOtp,
  sendParentMessage,
  verifyParentOtp,
} from "@/lib/nexus/server";
import { money, studentName } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/p/$slug")({
  component: ParentPortalPage,
});

type PortalData = Awaited<ReturnType<typeof getParentPortalSession>>;

const SESSION_KEY = (slug: string) => `nexus_parent_session_${slug}`;

function ParentPortalPage() {
  const { slug } = Route.useParams();
  const [phase, setPhase] = useState<"boot" | "login" | "otp" | "app">("boot");
  const [branding, setBranding] = useState<{
    name: string;
    appName: string;
    logo: string;
    primary: string;
  } | null>(null);
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [otpChannel, setOtpChannel] = useState<"sms" | "email">("sms");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [tab, setTab] = useState<"home" | "results" | "attendance" | "fees" | "notices" | "messages">("home");
  const [parentMsgs, setParentMsgs] = useState<{ id: string; sender_type: string; body: string; created_at: string }[]>([]);
  const [msgDraft, setMsgDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token =
          typeof localStorage !== "undefined"
            ? localStorage.getItem(SESSION_KEY(slug))
            : null;

        if (token) {
          try {
            const sessionData = await getParentPortalSession({
              data: { slug, token },
            });
            if (cancelled) return;
            setData(sessionData);
            setBranding({
              name: sessionData.school.name,
              appName: sessionData.school.parent_app_name || sessionData.school.name,
              logo: sessionData.school.logo_mark || "S",
              primary: sessionData.school.primary_color || "#0f766e",
            });
            if (sessionData.students[0]) setSelectedChildId(sessionData.students[0].id);
            applyTheme(
              sessionData.school.parent_app_name || sessionData.school.name,
              sessionData.school.primary_color,
            );
            setPhase("app");
            return;
          } catch {
            localStorage.removeItem(SESSION_KEY(slug));
          }
        }

        const publicPortal = await getParentPortal({ data: { slug } });
        if (cancelled) return;
        setBranding({
          name: publicPortal.school.name,
          appName: publicPortal.school.parent_app_name || publicPortal.school.name,
          logo: publicPortal.school.logo_mark || "S",
          primary: publicPortal.school.primary_color || "#0f766e",
        });
        applyTheme(
          publicPortal.school.parent_app_name || publicPortal.school.name,
          publicPortal.school.primary_color,
        );
        setPhase("login");
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load parent app");
          setPhase("login");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Dynamic PWA manifest for this school
  useEffect(() => {
    let link = document.querySelector('link[data-parent-manifest]') as HTMLLinkElement | null;
    let cancelled = false;
    getParentAppManifest({ data: { slug } })
      .then((manifest) => {
        if (cancelled) return;
        const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
        const url = URL.createObjectURL(blob);
        if (!link) {
          link = document.createElement("link");
          link.rel = "manifest";
          link.setAttribute("data-parent-manifest", "1");
          document.head.appendChild(link);
        }
        link.href = url;
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta && manifest.theme_color) meta.setAttribute("content", manifest.theme_color);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [slug]);


  function applyTheme(title: string, color?: string | null) {
    if (typeof document === "undefined") return;
    document.title = title;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta && color) meta.setAttribute("content", color);
  }

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestParentOtp({ data: { slug, phone, channel: otpChannel } });
      setPhase("otp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await verifyParentOtp({ data: { slug, phone, code } });
      localStorage.setItem(SESSION_KEY(slug), res.token);
      const sessionData = await getParentPortalSession({
        data: { slug, token: res.token },
      });
      setData(sessionData);
      if (sessionData.students[0]) setSelectedChildId(sessionData.students[0].id);
      setPhase("app");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  
  useEffect(() => {
    if (tab !== "messages" || phase !== "app") return;
    const token = localStorage.getItem(SESSION_KEY(slug));
    if (!token) return;
    listParentMessages({ data: { slug, token } })
      .then((r) => setParentMsgs(r.messages))
      .catch(() => {});
  }, [tab, phase, slug]);

  function logout() {
    localStorage.removeItem(SESSION_KEY(slug));
    setData(null);
    setPhase("login");
    setCode("");
  }

  const primary = branding?.primary || "#0f766e";

  if (phase === "boot") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-white">
        <p className="text-sm text-white/60">Loading…</p>
      </div>
    );
  }

  if (error && !branding) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
        <p className="text-lg font-medium">Unavailable</p>
        <p className="max-w-sm text-sm text-white/60">{error}</p>
      </div>
    );
  }

  if (phase === "login" || phase === "otp") {
    return (
      <div
        className="flex min-h-dvh flex-col text-white"
        style={{
          background: `linear-gradient(165deg, ${primary} 0%, #0b1220 45%, #0b1220 100%)`,
        }}
      >
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
          <span
            className="grid size-16 place-items-center rounded-2xl text-2xl font-semibold"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            {branding?.logo || "N"}
          </span>
          <h1 className="mt-4 text-center text-2xl font-semibold">
            {branding?.appName || "Parent app"}
          </h1>
          <p className="mt-1 text-center text-sm text-white/70">{branding?.name}</p>

          {phase === "login" && (
            <form onSubmit={handleRequestOtp} className="mt-8 w-full max-w-sm space-y-4">
              <div className="space-y-1.5">
                <Label className="text-white/80">Phone number</Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="e.g. 0991 234 567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="border-white/20 bg-white/10 text-white placeholder:text-white/40"
                />
                <p className="text-xs text-white/50">
                  Use the phone the school registered for you.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-white/80">Receive code by</Label>
                <div className="flex gap-4 text-sm text-white/80">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={otpChannel === "sms"}
                      onChange={() => setOtpChannel("sms")}
                    />
                    SMS
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      checked={otpChannel === "email"}
                      onChange={() => setOtpChannel("email")}
                    />
                    Email
                  </label>
                </div>
                <p className="text-xs text-white/50">
                  Email only works if the school saved your email on the parent record.
                </p>
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-white text-slate-900 hover:bg-white/90"
              >
                {busy ? "Sending code…" : "Send login code"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-white/50 underline"
                onClick={async () => {
                  const studentNumber = window.prompt("Student admission number (if known)");
                  const parentName = window.prompt("Your full name") || undefined;
                  if (!phone) {
                    setError("Enter your phone number first");
                    return;
                  }
                  try {
                    const res = await requestParentChildLink({
                      data: {
                        slug,
                        parentPhone: phone,
                        parentName,
                        studentNumber: studentNumber || undefined,
                      },
                    });
                    setError(null);
                    alert(res.message);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Request failed");
                  }
                }}
              >
                New here? Request to link your child
              </button>
            </form>
          )}

          {phase === "otp" && (
            <form onSubmit={handleVerifyOtp} className="mt-8 w-full max-w-sm space-y-4">
              <p className="text-center text-sm text-white/70">
                Code sent to <span className="font-medium text-white">{phone}</span>
              </p>
              
              <div className="space-y-1.5">
                <Label className="text-white/80">6-digit code</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                  className="border-white/20 bg-white/10 text-center text-lg tracking-[0.3em] text-white"
                />
              </div>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <Button
                type="submit"
                disabled={busy || code.length < 4}
                className="w-full bg-white text-slate-900 hover:bg-white/90"
              >
                {busy ? "Verifying…" : "Verify & continue"}
              </Button>
              <button
                type="button"
                className="w-full text-center text-sm text-white/50 underline"
                onClick={() => {
                  setPhase("login");
                  setCode("");
                  setError(null);
                              }}
              >
                Use a different number
              </button>
            </form>
          )}
        </div>
        <p className="pb-6 text-center text-xs text-white/40">
          Powered by NEXUS · Only this school&apos;s data is shown
        </p>
      </div>
    );
  }

  if (!data) return null;

  const {
    school,
    settings,
    students,
    results,
    attendance,
    charges,
    payments,
    announcements,
    classes,
    parent,
  } = data;
  const child = students.find((s) => s.id === selectedChildId) || students[0];
  const className = child ? classes.find((c) => c.id === child.class_id) : null;

  const childResults = child ? results.filter((r) => r.student_id === child.id) : [];
  const childAttendance = child ? attendance.filter((a) => a.student_id === child.id) : [];
  const present = childAttendance.filter((a) => a.status === "PRESENT").length;
  const attPct =
    childAttendance.length > 0
      ? Math.round((present / childAttendance.length) * 100)
      : null;

  const childCharges = child ? charges.filter((c) => c.student_id === child.id) : [];
  const totalCharged = childCharges.reduce(
    (a, c) => a + Number((c as { final_amount?: number }).final_amount ?? c.amount ?? 0),
    0,
  );
  const childPayments = child ? payments.filter((p) => p.student_id === child.id) : [];
  const totalPaid = childPayments.reduce((a, p) => a + Number(p.amount ?? 0), 0);
  const balance = Math.max(0, totalCharged - totalPaid);

  const tabs: { id: typeof tab; label: string; enabled: boolean }[] = [
    { id: "home", label: "Home", enabled: true },
    { id: "results", label: "Results", enabled: settings.results_enabled },
    { id: "attendance", label: "Attendance", enabled: settings.attendance_enabled },
    { id: "fees", label: "Fees", enabled: settings.fees_enabled },
    { id: "notices", label: "Notices", enabled: true },
    { id: "messages", label: "Messages", enabled: true },
  ];

  return (
    <div
      className="min-h-dvh text-white"
      style={{
        background: `linear-gradient(165deg, ${primary} 0%, #0b1220 42%, #0b1220 100%)`,
      }}
    >
      <header className="px-4 pb-4 pt-6">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <span
            className="grid size-12 shrink-0 place-items-center rounded-2xl text-lg font-semibold"
            style={{ background: "rgba(255,255,255,0.18)" }}
          >
            {school.logo_mark || school.name.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold leading-tight">
              {school.parent_app_name || school.name}
            </p>
            <p className="truncate text-xs text-white/70">
              {parent?.full_name || "Parent"}
              {school.city ? ` · ${school.city}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="shrink-0 rounded-lg bg-white/10 px-2 py-1 text-xs text-white/70"
          >
            Sign out
          </button>
        </div>

        {students.length > 1 && (
          <div className="mx-auto mt-4 flex max-w-lg gap-2 overflow-x-auto pb-1">
            {students.map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedChildId(st.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  selectedChildId === st.id ? "bg-white text-slate-900" : "bg-white/15 text-white"
                }`}
              >
                {st.first_name}
              </button>
            ))}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4 pb-28">
        {students.length === 0 && (
          <div className="rounded-2xl bg-white/10 p-4 text-sm text-white/80">
            No children are linked to your account yet. Contact the school office to verify your
            relationship.
          </div>
        )}

        {tab === "home" && child && (
          <div className="space-y-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wider text-white/60">Student</p>
              <p className="mt-1 text-xl font-semibold">{studentName(child)}</p>
              <p className="text-sm text-white/70">
                {className
                  ? `${className.section} · ${className.name}${className.stream ? ` ${className.stream}` : ""}`
                  : "—"}{" "}
                · {child.admission_number}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {settings.results_enabled && (
                <button
                  type="button"
                  onClick={() => setTab("results")}
                  className="rounded-2xl bg-white/10 p-4 text-left backdrop-blur"
                >
                  <p className="text-xs text-white/60">Results</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {childResults.length
                      ? `${Math.round(
                          childResults.reduce((a, r) => a + Number(r.overall_score ?? 0), 0) /
                            childResults.length,
                        )}%`
                      : "—"}
                  </p>
                </button>
              )}
              {settings.attendance_enabled && (
                <button
                  type="button"
                  onClick={() => setTab("attendance")}
                  className="rounded-2xl bg-white/10 p-4 text-left backdrop-blur"
                >
                  <p className="text-xs text-white/60">Attendance</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    {attPct != null ? `${attPct}%` : "—"}
                  </p>
                </button>
              )}
              {settings.fees_enabled && (
                <button
                  type="button"
                  onClick={() => setTab("fees")}
                  className="col-span-2 rounded-2xl bg-white/10 p-4 text-left backdrop-blur"
                >
                  <p className="text-xs text-white/60">Outstanding balance</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">{money(balance)}</p>
                </button>
              )}
            </div>
            {announcements[0] && (
              <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
                <p className="text-xs uppercase tracking-wider text-white/60">Latest notice</p>
                <p className="mt-1 font-medium">{announcements[0].title}</p>
                <p className="mt-1 line-clamp-3 text-sm text-white/70">{announcements[0].body}</p>
              </div>
            )}
            <p className="pt-2 text-center text-xs text-white/40">
              Add to Home Screen for the full app experience.
            </p>
          </div>
        )}

        {tab === "results" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Results</h2>
            {settings.results_enabled && childResults.length === 0 && (
              <p className="text-sm text-white/60">No published results yet.</p>
            )}
            {settings.results_enabled &&
              childResults.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3"
                >
                  <span className="text-sm">{r.subject_id?.slice(0, 16) || "Subject"}</span>
                  <span className="font-semibold tabular-nums">
                    {r.overall_score != null ? `${Number(r.overall_score)}%` : "—"}{" "}
                    <span className="text-white/60">{r.grade || ""}</span>
                  </span>
                </div>
              ))}
          </div>
        )}

        {tab === "attendance" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Attendance</h2>
            {attPct != null && <p className="text-3xl font-semibold tabular-nums">{attPct}%</p>}
            {childAttendance.slice(0, 14).map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm"
              >
                <span>{a.date}</span>
                <span
                  className={
                    a.status === "PRESENT"
                      ? "text-emerald-300"
                      : a.status === "LATE"
                        ? "text-amber-300"
                        : "text-red-300"
                  }
                >
                  {a.status}
                </span>
              </div>
            ))}
            {childAttendance.length === 0 && (
              <p className="text-sm text-white/60">No attendance records yet.</p>
            )}
          </div>
        )}

        {tab === "fees" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Fees</h2>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-xs text-white/60">Balance</p>
              <p className="text-3xl font-semibold tabular-nums">{money(balance)}</p>
              <p className="mt-1 text-xs text-white/50">
                Charged {money(totalCharged)} · Paid {money(totalPaid)}
              </p>
            </div>
            {childPayments.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm"
              >
                <span>{p.payment_date || "Payment"}</span>
                <span className="tabular-nums text-emerald-300">{money(p.amount)}</span>
              </div>
            ))}
          </div>
        )}

        
        {tab === "messages" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Messages</h2>
            <ul className="space-y-2">
              {parentMsgs.map((m) => (
                <li
                  key={m.id}
                  className={`rounded-xl px-4 py-3 text-sm ${
                    m.sender_type === "SCHOOL" ? "bg-white/15" : "bg-white/5"
                  }`}
                >
                  <p className="text-xs text-white/50">{m.sender_type}</p>
                  <p className="mt-1">{m.body}</p>
                </li>
              ))}
              {parentMsgs.length === 0 && (
                <p className="text-sm text-white/60">No messages yet.</p>
              )}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                const token = localStorage.getItem(SESSION_KEY(slug));
                if (!token || !msgDraft.trim()) return;
                try {
                  await sendParentMessage({
                    data: { slug, token, body: msgDraft },
                  });
                  setMsgDraft("");
                  const r = await listParentMessages({ data: { slug, token } });
                  setParentMsgs(r.messages);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Failed");
                }
              }}
            >
              <input
                className="flex-1 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
                placeholder="Message the school…"
                value={msgDraft}
                onChange={(e) => setMsgDraft(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {tab === "notices" && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold">Notices</h2>
            {announcements.map((a) => (
              <div key={a.id} className="rounded-2xl bg-white/10 p-4">
                <p className="font-medium">{a.title}</p>
                <p className="mt-1 text-sm text-white/70">{a.body}</p>
              </div>
            ))}
            {announcements.length === 0 && (
              <p className="text-sm text-white/60">No announcements yet.</p>
            )}
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg justify-around px-2 py-2">
          {tabs
            .filter((t) => t.enabled)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`rounded-lg px-3 py-2 text-xs font-medium ${
                  tab === t.id ? "bg-white/15 text-white" : "text-white/50"
                }`}
              >
                {t.label}
              </button>
            ))}
        </div>
      </nav>
    </div>
  );
}
