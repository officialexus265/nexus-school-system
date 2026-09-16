import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import {
  classById,
  classLabel,
  publishedTerm,
  studentAttendance,
  studentAverage,
  studentBalance,
  studentPosition,
} from "@/lib/nexus/selectors";
import { formatDate, money, num, pct, studentName } from "@/lib/utils";

export const Route = createFileRoute("/app/students/$studentId")({ component: StudentFile });

function StudentFile() {
  const { studentId } = Route.useParams();
  const q = useSnapshot();
  if (q.isPending) return <Skeleton className="h-80" />;
  if (!q.data) return null;
  const snap = q.data;
  const s = snap.students.find((x) => x.id === studentId);
  if (!s) {
    return (
      <div>
        <p>Student not found.</p>
        <Link to="/app/students" className="text-sm text-primary hover:underline">
          Back
        </Link>
      </div>
    );
  }
  const term = publishedTerm(snap);
  const avg = term ? studentAverage(snap, s.id, term.id, true) : null;
  const pos = term ? studentPosition(snap, s.id, term.id) : null;
  const parents = snap.parentLinks
    .filter((l) => l.student_id === s.id)
    .map((l) => ({
      ...l,
      parent: snap.parents.find((p) => p.id === l.parent_id),
    }));
  const charges = snap.charges.filter((c) => c.student_id === s.id);
  const results = term ? snap.results.filter((r) => r.student_id === s.id && r.term_id === term.id) : [];

  return (
    <div>
      <PageHeader
        kicker={s.admission_number}
        title={studentName(s)}
        description={`${classLabel(classById(snap, s.class_id))} · ${s.gender === "F" ? "Female" : "Male"} · born ${formatDate(s.date_of_birth)}`}
      />
      <div className="grid gap-3 sm:grid-cols-4">
        <Mini label="Attendance" value={pct(studentAttendance(snap, s.id))} />
        <Mini label={`${term?.name ?? "Term"} average`} value={avg != null ? pct(avg) : "—"} />
        <Mini label="Position" value={pos ? String(pos) : "—"} />
        <Mini label="Balance" value={money(studentBalance(snap, s.id))} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Parents</h2>
          <ul className="mt-3 space-y-2">
            {parents.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>
                  {p.parent?.full_name} · {p.relationship}
                </span>
                <StatusPill value={p.parent?.verification_status ?? "PENDING"} />
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Published subjects</h2>
          <ul className="mt-3 space-y-2">
            {results.map((r) => (
              <li key={r.id} className="flex items-center justify-between text-sm">
                <span>{snap.subjects.find((x) => x.id === r.subject_id)?.name}</span>
                <span className="tabular-nums">
                  {num(r.overall_score)} {r.grade}
                </span>
              </li>
            ))}
            {results.length === 0 ? <p className="text-sm text-muted-foreground">Nothing published yet.</p> : null}
          </ul>
        </section>
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)] lg:col-span-2">
          <h2 className="font-display text-xl">Charges</h2>
          <ul className="mt-3 divide-y divide-border">
            {charges.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>{c.description}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums">{money(c.paid)} / {money(c.amount)}</span>
                  <StatusPill value={c.status} />
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl tabular-nums">{value}</p>
    </div>
  );
}
