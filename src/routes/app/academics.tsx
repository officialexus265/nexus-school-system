import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { classById, classLabel } from "@/lib/nexus/selectors";
import { formatDate, num } from "@/lib/utils";

export const Route = createFileRoute("/app/academics")({ component: AcademicsPage });

function AcademicsPage() {
  const q = useSnapshot();
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  return (
    <div>
      <PageHeader
        kicker="Structure"
        title="Academics"
        description="Sections, years, terms, classes and assessments — none of it assumes a fixed curriculum."
      />
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Classes</h2>
          <ul className="mt-3 divide-y divide-border">
            {snap.classes.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {classLabel(c)}
                  <span className="ml-2 text-xs text-muted-foreground">{c.section}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  {snap.students.filter((s) => s.class_id === c.id).length} students
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Terms</h2>
          <ul className="mt-3 divide-y divide-border">
            {snap.terms.map((t) => (
              <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {t.name} {t.is_current ? <StatusPill value="ACTIVE" /> : null}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(t.start_date)} – {formatDate(t.end_date)}
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">Assessments</h2>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="py-2 font-medium">Name</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium">Class</th>
                  <th className="py-2 font-medium">Due</th>
                  <th className="py-2 font-medium">Weight</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {snap.assessments.map((a) => (
                  <tr key={a.id} className="border-b border-border last:border-0">
                    <td className="py-2">{a.name}</td>
                    <td className="py-2 text-muted-foreground">{a.assessment_type}</td>
                    <td className="py-2">{classLabel(classById(snap, a.class_id))}</td>
                    <td className="py-2 tabular-nums">{formatDate(a.due_date)}</td>
                    <td className="py-2 tabular-nums">{a.weight}%</td>
                    <td className="py-2">
                      <StatusPill value={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Algebra quiz marked — John {num(snap.scores.find((s) => s.assessment_id === snap.assessments[0]?.id && s.student_id.includes("john"))?.score)} / 20.
          </p>
        </section>
      </div>
    </div>
  );
}
