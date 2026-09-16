import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import {
  enqueueBackgroundJob,
  exportChargesCsv,
  exportPaymentsCsv,
  exportStudentsCsv,
  listBackgroundJobs,
  processBackgroundJobs,
  searchSchool,
} from "@/lib/nexus/server";
import { studentName } from "@/lib/utils";

export const Route = createFileRoute("/app/tools")({ component: ToolsPage });

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function ToolsPage() {
  const q = useSnapshot();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchSchool>> | null>(
    null,
  );
  const [jobs, setJobs] = useState<
    Awaited<ReturnType<typeof listBackgroundJobs>>["jobs"]
  >([]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const schoolId = q.data.school.id;

  async function doSearch() {
    try {
      setResults(await searchSchool({ data: { schoolId, q: query } }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    }
  }

  async function loadJobs() {
    try {
      setJobs((await listBackgroundJobs()).jobs);
    } catch {
      /* table may be missing on first run */
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Hardening"
        title="Search, exports & jobs"
        description="Find students and receipts, download CSV reports, queue and run background tasks."
      />

      <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Search</h2>
        <div className="mt-3 flex gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, admission no., phone, receipt…"
            onKeyDown={(e) => e.key === "Enter" && void doSearch()}
          />
          <Button onClick={() => void doSearch()}>Search</Button>
        </div>
        {results && (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ResultBlock title="Students">
              {results.students.map((s) => (
                <Link
                  key={s.id}
                  to="/app/students/$studentId"
                  params={{ studentId: s.id }}
                  className="block rounded px-2 py-1 text-sm hover:bg-secondary"
                >
                  {s.first_name} {s.last_name} · {s.admission_number}
                </Link>
              ))}
              {results.students.length === 0 && <Empty />}
            </ResultBlock>
            <ResultBlock title="Parents">
              {results.parents.map((p) => (
                <div key={p.id} className="px-2 py-1 text-sm">
                  {p.full_name} · {p.phone}
                </div>
              ))}
              {results.parents.length === 0 && <Empty />}
            </ResultBlock>
            <ResultBlock title="Payments / receipts">
              {results.payments.map((p) => (
                <div key={p.id} className="px-2 py-1 text-sm">
                  {p.receipt_number || p.reference} · {p.payment_date}
                </div>
              ))}
              {results.payments.length === 0 && <Empty />}
            </ResultBlock>
            <ResultBlock title="Staff">
              {results.staff.map((s) => (
                <div key={s.id} className="px-2 py-1 text-sm">
                  {s.full_name} · {s.role_title}
                </div>
              ))}
              {results.staff.length === 0 && <Empty />}
            </ResultBlock>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">CSV exports</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const r = await exportStudentsCsv({ data: { schoolId } });
                downloadCsv(r.filename, r.csv);
                toast.success(`${r.count} students`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Export students
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const r = await exportPaymentsCsv({ data: { schoolId } });
                downloadCsv(r.filename, r.csv);
                toast.success(`${r.count} payments`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Export payments
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const r = await exportChargesCsv({ data: { schoolId } });
                downloadCsv(r.filename, r.csv);
                toast.success(`${r.count} charges`);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Export charges
          </Button>
        </div>
      </section>

      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl">Background jobs</h2>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const r = await enqueueBackgroundJob({
                    data: { jobType: "FEE_REMINDERS", schoolId },
                  });
                  toast.success(`Queued ${r.jobId}`);
                  await loadJobs();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Queue fee reminders
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const r = await enqueueBackgroundJob({
                    data: { jobType: "GENERATE_INVOICES" },
                  });
                  toast.success(`Queued ${r.jobId}`);
                  await loadJobs();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Queue invoices
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                try {
                  const r = await processBackgroundJobs();
                  toast.success(`Processed ${r.processed} job(s)`);
                  await loadJobs();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Run queue now
            </Button>
            <Button variant="outline" size="sm" onClick={() => void loadJobs()}>
              Refresh
            </Button>
          </div>
        </div>
        <ul className="mt-3 divide-y divide-border text-sm">
          {jobs.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                {j.job_type} · {j.id.slice(0, 12)}…
                {j.last_error ? (
                  <span className="text-xs text-red-500"> · {j.last_error}</span>
                ) : null}
              </span>
              <StatusPill value={j.status} />
            </li>
          ))}
          {jobs.length === 0 && (
            <li className="py-3 text-muted-foreground">No jobs loaded. Queue one or refresh.</li>
          )}
        </ul>
      </section>
    </div>
  );
}

function ResultBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="mt-1 rounded-lg border border-border p-1">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="px-2 py-1 text-xs text-muted-foreground">No matches</p>;
}
