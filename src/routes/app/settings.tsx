import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { updateSchool } from "@/lib/nexus/server";

export const Route = createFileRoute("/app/settings")({ component: SettingsPage });

function SettingsPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const s = q.data?.school;
  const [motto, setMotto] = useState(s?.motto ?? "");
  const [phone, setPhone] = useState(s?.phone ?? "");
  const [email, setEmail] = useState(s?.email ?? "");
  const [busy, setBusy] = useState(false);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data || !s) return null;

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
          <h2 className="font-display text-xl">Branding</h2>
          <div className="mt-4 flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-xl bg-primary font-display text-2xl text-primary-foreground">
              {s.logo_mark}
            </span>
            <div>
              <p className="text-sm">Parent app icon</p>
              <p className="text-xs text-muted-foreground">Primary {s.primary_color}</p>
            </div>
          </div>
          <p className="mt-4 text-sm italic text-muted-foreground">“{s.motto}”</p>
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
            Save
          </Button>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">Parent app modules</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            {["Results", "Attendance", "Behaviour", "Fees", "Assignments", "Timetable", "Calendar", "Documents"].map(
              (m) => (
                <li key={m} className="rounded-lg bg-secondary px-3 py-2">
                  {m} · enabled
                </li>
              ),
            )}
          </ul>
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
