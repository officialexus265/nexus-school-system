import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  getSchoolSmsSettings,
  publishParentApp,
  saveSchoolSmsSettings,
  updateSchool,
  updateSchoolBillingPrefs,
} from "@/lib/nexus/server";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const s = q.data?.school;

  const [motto, setMotto] = useState(s?.motto ?? "");
  const [phone, setPhone] = useState(s?.phone ?? "");
  const [email, setEmail] = useState(s?.email ?? "");
  const [busy, setBusy] = useState(false);

  // Parent app branding
  const [appName, setAppName] = useState(s?.parent_app_name ?? "");
  const [logoMark, setLogoMark] = useState(s?.logo_mark ?? "");
  const [primaryColor, setPrimaryColor] = useState(s?.primary_color ?? "#0f766e");
  const [secondaryColor, setSecondaryColor] = useState(s?.secondary_color ?? "#134e4a");
  const [modules, setModules] = useState({
    results: true,
    attendance: true,
    behaviour: true,
    fees: true,
    assignments: true,
    messages: true,
    documents: true,
    calendar: true,
  });
  const [publishBusy, setPublishBusy] = useState(false);
  const [installUrl, setInstallUrl] = useState<string | null>(null);

  const [smsApiKey, setSmsApiKey] = useState("");
  const [smsFrom, setSmsFrom] = useState("");
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [smsMasked, setSmsMasked] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "term" | "annual">("monthly");


  useEffect(() => {
    if (!s) return;
    setMotto(s.motto ?? "");
    setPhone(s.phone ?? "");
    setEmail(s.email ?? "");
    setAppName(s.parent_app_name ?? `${s.name} Parent`);
    setLogoMark(s.logo_mark ?? s.name.slice(0, 2).toUpperCase());
    setPrimaryColor(s.primary_color ?? "#0f766e");
    setSecondaryColor(s.secondary_color ?? "#134e4a");
  }, [s?.id, s?.parent_app_name, s?.logo_mark, s?.primary_color, s?.secondary_color, s?.motto, s?.phone, s?.email, s?.name]);

  useEffect(() => {
    if (!s?.id) return;
    getSchoolSmsSettings({ data: { schoolId: s.id } })
      .then((r) => {
        setSmsMasked(r.apiKeyMasked);
        setSmsFrom(r.fromNumber || "");
        setSmsEnabled(r.enabled);
      })
      .catch(() => {});
  }, [s?.id]);


  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data || !s) return null;

  async function handlePublish() {
    setPublishBusy(true);
    try {
      const result = await publishParentApp({
        data: {
          schoolId: s!.id,
          appName: appName || `${s!.name} Parent`,
          primaryColor,
          secondaryColor,
          logoMark,
          resultsEnabled: modules.results,
          attendanceEnabled: modules.attendance,
          behaviourEnabled: modules.behaviour,
          feesEnabled: modules.fees,
          assignmentsEnabled: modules.assignments,
          messagesEnabled: modules.messages,
          documentsEnabled: modules.documents,
          calendarEnabled: modules.calendar,
        },
      });
      setInstallUrl(result.installUrl);
      toast.success("Parent app published");
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setPublishBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Configuration"
        title={s.name}
        description="School identity, branding and the parent app share one configuration."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Profile</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <Row k="Registration" v={s.registration_number} />
            <Row k="Address" v={`${s.address}, ${s.city}`} />
            <Row k="Type" v={`${s.school_type} · ${s.boarding_status}`} />
            <Row k="Timezone" v={s.timezone} />
            <Row k="Currency" v={s.currency} />
            <Row k="Plan" v={s.subscription_plan} />
          </dl>
          <div className="mt-4">
            <StatusPill value={s.status} />
          </div>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Live branding preview</h2>
          <div
            className="mt-4 flex items-center gap-4 rounded-xl p-4"
            style={{ background: primaryColor, color: "#fff" }}
          >
            <span
              className="grid size-14 place-items-center rounded-xl font-display text-xl"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              {logoMark || "??"}
            </span>
            <div>
              <p className="font-medium">{appName || `${s.name} Parent`}</p>
              <p className="text-xs opacity-80">Parent app icon · home screen</p>
            </div>
          </div>
          <p className="mt-3 text-sm italic text-muted-foreground">“{motto || s.motto || "—"}”</p>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">Edit contact</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-3">
              <Label>Motto</Label>
              <Input value={motto} onChange={(e) => setMotto(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Email</Label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <Button
            className="mt-4"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await updateSchool({ data: { schoolId: s.id, motto, phone, email } });
                toast.success("Saved");
                await invalidate();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Save contact
          </Button>
        </section>

        {/* Parent App builder */}
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">Parent app</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure branding and modules, then publish. You get a link/QR to share on WhatsApp.
            Parents open it, install to home screen, and only ever see this school.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>App name (under icon)</Label>
              <Input
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder={`${s.name} Parent`}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Logo mark (2–3 letters)</Label>
              <Input
                value={logoMark}
                onChange={(e) => setLogoMark(e.target.value.slice(0, 3).toUpperCase())}
                maxLength={3}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Primary colour</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Secondary colour</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer p-1"
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
              </div>
            </div>
          </div>

          <h3 className="mt-6 text-sm font-medium">Enabled modules</h3>
          <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            {(
              [
                ["results", "Results"],
                ["attendance", "Attendance"],
                ["behaviour", "Behaviour"],
                ["fees", "Fees"],
                ["assignments", "Assignments"],
                ["messages", "Messages"],
                ["documents", "Documents"],
                ["calendar", "Calendar"],
              ] as const
            ).map(([key, label]) => (
              <label
                key={key}
                className="flex cursor-pointer items-center gap-2 rounded-lg bg-secondary px-3 py-2"
              >
                <input
                  type="checkbox"
                  checked={modules[key]}
                  onChange={(e) =>
                    setModules((m) => ({ ...m, [key]: e.target.checked }))
                  }
                  className="size-4 accent-primary"
                />
                {label}
              </label>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={handlePublish} disabled={publishBusy}>
              {publishBusy ? "Publishing…" : "Publish parent app"}
            </Button>
            {(installUrl || s.parent_app_slug) && (
              <span className="text-xs text-muted-foreground">
                Slug: <code>{s.parent_app_slug || "—"}</code>
              </span>
            )}
          </div>

          {(installUrl || s.parent_app_slug) && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm font-medium">
                Install link — share on WhatsApp with parents
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">
                  {installUrl ||
                    `${typeof window !== "undefined" ? window.location.origin : ""}/p/${s.parent_app_slug}`}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url =
                      installUrl ||
                      `${window.location.origin}/p/${s.parent_app_slug}`;
                    navigator.clipboard.writeText(url);
                    toast.success("Link copied — paste into WhatsApp");
                  }}
                >
                  Copy link
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url =
                      installUrl ||
                      `${window.location.origin}/p/${s.parent_app_slug}`;
                    window.open(url, "_blank");
                  }}
                >
                  Open preview
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Parents open the link on their phone → “Add to Home Screen”. The icon and name
                match your branding. The app is locked to {s.name} only.
              </p>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">httpSMS (this school)</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each school uses its own httpSMS account (Android phone as gateway) for parent OTP,
            fee reminders and notices. Get API key from https://httpsms.com/settings
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>API key</Label>
              <Input
                type="password"
                value={smsApiKey}
                onChange={(e) => setSmsApiKey(e.target.value)}
                placeholder={smsMasked ? `Saved: ${smsMasked}` : "Paste httpSMS API key"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>From number (phone with httpSMS app)</Label>
              <Input
                value={smsFrom}
                onChange={(e) => setSmsFrom(e.target.value)}
                placeholder="+26599..."
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={smsEnabled}
                onChange={(e) => setSmsEnabled(e.target.checked)}
                className="size-4 accent-primary"
              />
              Enabled
            </label>
          </div>
          <Button
            className="mt-4"
            onClick={async () => {
              if (!smsApiKey && !smsMasked) {
                toast.error("Enter API key");
                return;
              }
              try {
                await saveSchoolSmsSettings({
                  data: {
                    schoolId: s.id,
                    apiKey: smsApiKey || "keep-existing-placeholder",
                    fromNumber: smsFrom,
                    enabled: smsEnabled,
                  },
                });
                // If placeholder, still update from/enabled only via re-save with real key preferred
                toast.success("httpSMS settings saved");
                const r = await getSchoolSmsSettings({ data: { schoolId: s.id } });
                setSmsMasked(r.apiKeyMasked);
                setSmsApiKey("");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Save httpSMS
          </Button>
        </section>

        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">Subscription billing preference</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            How this school prefers to pay NEXUS (platform invoices). Tier is inferred from school type
            (Primary / Secondary / Both).
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {(["monthly", "term", "annual"] as const).map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="billingPeriod"
                  checked={billingPeriod === p}
                  onChange={() => setBillingPeriod(p)}
                />
                {p === "monthly" ? "Monthly" : p === "term" ? "Per term" : "Academic year"}
              </label>
            ))}
          </div>
          <Button
            className="mt-4"
            variant="outline"
            onClick={async () => {
              try {
                await updateSchoolBillingPrefs({
                  data: { schoolId: s.id, billingPeriod },
                });
                toast.success("Billing preference saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Save billing preference
          </Button>
        </section>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border py-2">
      <dt className="text-muted-foreground">{k}</dt>
      <dd>{v ?? "—"}</dd>
    </div>
  );
}
