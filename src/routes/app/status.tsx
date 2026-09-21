import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { exportSchoolBackup, getSchoolHealth, listSchoolAudit } from "@/lib/nexus/server";
import { toast } from "sonner";

export const Route = createFileRoute("/app/status")({ component: SchoolStatusPage });

function SchoolStatusPage() {
  const q = useSnapshot();
  const [data, setData] = useState<Awaited<ReturnType<typeof getSchoolHealth>> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load(schoolId: string) {
    setErr(null);
    try {
      setData(await getSchoolHealth({ data: { schoolId } }));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setData(null);
    }
  }

  useEffect(() => {
    if (q.data?.school?.id && q.data.school.id !== "none") {
      void load(q.data.school.id);
    }
  }, [q.data?.school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data?.school || q.data.school.id === "none") {
    return (
      <p className="text-sm text-muted-foreground">No school linked to this account yet.</p>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Operations"
        title="School health"
        description="Readiness, backup download, and audit. If data is lost: restore from your JSON backup and/or Neon PITR."
        actions={
          <Button variant="outline" onClick={() => void load(q.data!.school.id)}>
            Refresh
          </Button>
        }
      />
      {err && <p className="text-sm text-red-600">{err}</p>}
      {data && (
        <>
          <div className="mb-4 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-secondary px-3 py-1">
              Status: <strong>{data.status}</strong>
            </span>
            <span className="rounded-full bg-secondary px-3 py-1">
              OK {data.summary.ok} · Warn {data.summary.warn} · Fail {data.summary.fail}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Students" value={String(data.counts.students)} />
            <Stat label="Parents" value={String(data.counts.parents)} />
            <Stat label="Staff" value={String(data.counts.staff)} />
            <Stat label="Open charges" value={String(data.counts.openCharges)} />
          </div>
          <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Readiness checks</h2>
            <ul className="mt-3 divide-y divide-border">
              {data.checks.map((c) => (
                <li
                  key={c.id}
                  className="flex flex-wrap items-start justify-between gap-2 py-3 text-sm"
                >
                  <span className="font-medium">{c.label}</span>
                  <span
                    className={
                      c.status === "ok"
                        ? "text-right text-emerald-600"
                        : c.status === "fail"
                          ? "text-right text-red-600"
                          : "text-right text-amber-600"
                    }
                  >
                    <span className="uppercase tracking-wide">{c.status}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                      {c.detail}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {data.parentAppUrl && (
              <p className="mt-4 text-sm">
                Parent app:{" "}
                <a className="underline" href={data.parentAppUrl} target="_blank" rel="noreferrer">
                  {data.parentAppUrl}
                </a>
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const bak = await exportSchoolBackup({
                      data: { schoolId: q.data!.school.id },
                    });
                    const blob = new Blob([JSON.stringify(bak, null, 2)], {
                      type: "application/json",
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `nexus-backup-${q.data!.school.slug || "school"}-${new Date().toISOString().slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success("Backup downloaded — store it safely offline");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Backup failed");
                  }
                }}
              >
                Download full backup (JSON)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const r = await listSchoolAudit({
                      data: { schoolId: q.data!.school.id, limit: 50 },
                    });
                    console.log("Audit", r.rows);
                    toast.message(`${r.rows.length} audit rows (see browser console)`);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Audit failed");
                  }
                }}
              >
                View audit log
              </Button>
              <Link to="/app/settings">
                <Button variant="outline" size="sm">
                  School settings
                </Button>
              </Link>
              <Link to="/app/people">
                <Button variant="outline" size="sm">
                  Staff & parents
                </Button>
              </Link>
              <Link to="/app/finance">
                <Button variant="outline" size="sm">
                  Finance
                </Button>
              </Link>
            </div>
          </section>
        </>
      )}
      {!data && !err && <Skeleton className="h-40" />}
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
