import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { activateSchool } from "@/lib/nexus/server";
import { money } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/platform")({ component: PlatformPage });

function PlatformPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const setPersona = useNexusSession((s) => s.setPersona);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const schools = q.data.schools;
  const active = schools.filter((s) => s.status === "ACTIVE").length;

  return (
    <div>
      <PageHeader
        kicker="NEXUS"
        title="Platform owner"
        description="Register, activate and suspend schools. Expired tenants move through grace — data is never deleted for non-payment."
        actions={
          <Button variant="outline" onClick={() => setPersona("owner")}>
            Enter Sunrise
          </Button>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Schools" value={String(schools.length)} />
        <StatCard label="Active" value={String(active)} />
        <StatCard
          label="Activation book"
          value={money(schools.reduce((a, s) => a + Number(s.activation_fee ?? 0), 0))}
        />
      </div>
      <div className="mt-6 overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.registration_number}</p>
                </td>
                <td className="px-4 py-3">{s.city}</td>
                <td className="px-4 py-3">{s.subscription_plan}</td>
                <td className="px-4 py-3 tabular-nums">{money(s.activation_fee)}</td>
                <td className="px-4 py-3">
                  <StatusPill value={s.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {s.status !== "ACTIVE" ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await activateSchool({ data: { schoolId: s.id } });
                          toast.success(`${s.name} is now active`);
                          await invalidate();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                    >
                      Activate
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Live</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Audit</h2>
        <ul className="mt-3 space-y-2">
          {q.data.audit.slice(0, 8).map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
              <span className="text-muted-foreground"> · {a.actor} · {a.detail}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
