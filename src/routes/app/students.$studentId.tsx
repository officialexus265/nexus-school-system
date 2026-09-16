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
import { Button } from "@/components/ui/button";
import { generateReportCard, getStudentIdCard } from "@/lib/nexus/server";
import { toast } from "sonner";

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
        actions={
          <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const term = publishedTerm(snap);
                if (!term) {
                  toast.error("No published term");
                  return;
                }
                const rc = await generateReportCard({
                  data: { schoolId: snap.school.id, studentId: s.id, termId: term.id },
                });
                const w = window.open("", "_blank", "width=720,height=900");
                if (!w) return;
                const color = rc.school.primary_color || "#0f766e";
                const rows = rc.rows
                  .map(
                    (r) =>
                      `<tr><td>${r.subject}</td><td>${r.code || ""}</td><td>${r.score ?? "—"}</td><td>${r.grade || "—"}</td></tr>`,
                  )
                  .join("");
                w.document.write(`<!DOCTYPE html><html><head><title>Report — ${rc.student.name}</title>
                <style>
                  body{font-family:system-ui,sans-serif;padding:32px;color:#111}
                  h1{font-size:20px;margin:0;color:${color}}
                  .muted{color:#666;font-size:12px}
                  table{width:100%;border-collapse:collapse;margin-top:16px}
                  th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}
                  th{background:#f5f5f5}
                  .foot{margin-top:16px;font-size:14px}
                  @media print{button{display:none}}
                </style></head><body>
                <h1>${rc.school.name}</h1>
                <p class="muted">${rc.school.motto || ""} · ${rc.school.address || ""} · ${rc.school.phone || ""}</p>
                <h2 style="margin:16px 0 4px">Report card — ${rc.term}</h2>
                <p><strong>${rc.student.name}</strong> · ${rc.student.admission_number} · ${rc.student.classLabel}</p>
                <table><thead><tr><th>Subject</th><th>Code</th><th>Score</th><th>Grade</th></tr></thead>
                <tbody>${rows}</tbody></table>
                <p class="foot">Average: <strong>${rc.average ?? "—"}</strong>
                ${rc.position != null ? ` · Position: <strong>${rc.position}</strong>` : ""}</p>
                <p class="muted">Generated ${new Date(rc.generatedAt).toLocaleString()}</p>
                <button onclick="window.print()">Print / Save PDF</button>
                </body></html>`);
                w.document.close();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Report card
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                const card = await getStudentIdCard({
                  data: { schoolId: snap.school.id, studentId: s.id },
                });
                const w = window.open("", "_blank", "width=420,height=280");
                if (!w || !card.school || !card.student) return;
                const color = card.school.primary_color || "#0f766e";
                w.document.write(`<!DOCTYPE html><html><head><title>ID ${card.student.admission_number}</title>
                <style>
                  body{font-family:system-ui,sans-serif;margin:24px}
                  .card{width:360px;border:2px solid ${color};border-radius:12px;padding:16px;display:flex;gap:12px}
                  .mark{width:56px;height:56px;border-radius:12px;background:${color};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px}
                  h1{font-size:14px;margin:0}
                  .name{font-size:18px;font-weight:600;margin:4px 0}
                  .muted{color:#666;font-size:12px}
                  @media print{button{display:none}}
                </style></head><body>
                <div class="card">
                  <div class="mark">${(card.school.logo_mark || card.school.name.slice(0,2)).toUpperCase()}</div>
                  <div>
                    <h1>${card.school.name}</h1>
                    <p class="name">${card.student.name}</p>
                    <p class="muted">${card.student.classLabel}</p>
                    <p class="muted">ID: ${card.student.admission_number}</p>
                  </div>
                </div>
                <p style="margin-top:12px"><button onclick="window.print()">Print ID card</button></p>
                </body></html>`);
                w.document.close();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Print ID card
          </Button>
          </div>
        }
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
