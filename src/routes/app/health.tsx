import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPlatformHealth,
  listPlatformSupport,
  reconcilePendingPayments,
} from "@/lib/nexus/server";

export const Route = createFileRoute("/app/health")({ component: HealthPage });

type Check = { id: string; label: string; status: string; detail: string };

function HealthPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getPlatformHealth>> | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      setData(await getPlatformHealth());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setData(null);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data && !err) return <Skeleton className="h-64" />;

  const checks = (data as { checks?: Check[] } | null)?.checks || [];

  return (
    <div>
      <PageHeader
        kicker="System owner"
        title="Platform health"
        description="Estate counts, integration status, and cron controls for hands-off operations."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Schools" value={String(data.schools)} />
            <Stat label="Active" value={String(data.activeSchools)} />
            <Stat label="Open invoices" value={String(data.openInvoices)} />
            <Stat
              label="Overdue invoices"
              value={String((data as { overdueInvoices?: number }).overdueInvoices ?? "—")}
            />
            <Stat
              label="Pending payment"
              value={String((data as { pendingPaymentSchools?: number }).pendingPaymentSchools ?? "—")}
            />
            <Stat
              label="Grace period"
              value={String((data as { graceSchools?: number }).graceSchools ?? "—")}
            />
            <Stat
              label="Jobs pending"
              value={String((data as { jobsPending?: number }).jobsPending ?? "—")}
            />
            <Stat
              label="SMS (7 days)"
              value={String((data as { sms7d?: number }).sms7d ?? "—")}
            />
          </div>

          <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Integration checks</h2>
            <ul className="mt-3 space-y-2">
              {checks.map((c) => (
                <CheckRow key={c.id} {...c} />
              ))}
              {checks.length === 0 &&
                Object.entries(data.env).map(([k, ok]) => (
                  <CheckRow
                    key={k}
                    id={k}
                    label={k}
                    status={ok ? "ok" : "warn"}
                    detail={ok ? "configured" : "missing"}
                  />
                ))}
            </ul>
            <p className="mt-4 text-xs text-muted-foreground">{data.cronHint}</p>
            <Button
              className="mt-3"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const secret = window.prompt("CRON_SECRET (blank allowed in local dev)");
                  const url = `/api/cron?job=all${secret ? `&secret=${encodeURIComponent(secret)}` : ""}`;
                  const res = await fetch(url);
                  const body = await res.json();
                  if (!res.ok) throw new Error(body.error || res.statusText);
                  toast.success("Cron job=all completed");
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Cron failed");
                }
              }}
            >
              Run cron job=all now
            </Button>
            <Button
              className="mt-3 ml-2"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const r = await reconcilePendingPayments();
                  toast.success(
                    `Reconciled: ${r.fulfilled} ok, ${r.failed} failed, ${r.checked} checked`,
                  );
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Reconcile pending PayChangu
            </Button>
          </section>

          <SupportPanel />

        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl">{value}</p>
    </div>
  );
}

function CheckRow({
  label,
  status,
  detail,
}: {
  id?: string;
  label: string;
  status: string;
  detail: string;
}) {
  const color =
    status === "ok"
      ? "text-emerald-600"
      : status === "fail"
        ? "text-red-600"
        : "text-amber-600";
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 border-b border-border py-2 text-sm">
      <span className="font-medium">{label}</span>
      <span className={`text-right ${color}`}>
        <span className="uppercase tracking-wide">{status}</span>
        <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{detail}</span>
      </span>
    </li>
  );
}


function SupportPanel() {
  const [data, setData] = useState<{
    sms: unknown[];
    payments: unknown[];
    jobs: unknown[];
  } | null>(null);
  return (
    <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-xl">Support tooling</h2>
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            try {
              setData(await listPlatformSupport());
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Load SMS / payments / jobs
        </Button>
      </div>
      {data && (
        <div className="mt-4 grid gap-4 lg:grid-cols-3 text-xs">
          <pre className="max-h-64 overflow-auto rounded border border-border p-2">
            SMS{"\n"}
            {JSON.stringify(data.sms, null, 2)}
          </pre>
          <pre className="max-h-64 overflow-auto rounded border border-border p-2">
            Payments{"\n"}
            {JSON.stringify(data.payments, null, 2)}
          </pre>
          <pre className="max-h-64 overflow-auto rounded border border-border p-2">
            Jobs{"\n"}
            {JSON.stringify(data.jobs, null, 2)}
          </pre>
        </div>
      )}
    </section>
  );
}
