import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
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
import {
  generateReportCard,
  getBehaviourSettings,
  getStudentIdCard,
} from "@/lib/nexus/server";
import { formatDate, money, num, pct, studentName } from "@/lib/utils";

export const Route = createFileRoute("/app/students/$studentId")({ component: StudentFile });

function StudentFile() {
  const { studentId } = Route.useParams();
  const q = useSnapshot();
  const [behaviour, setBehaviour] = useState<{
    enabled: boolean;
    score: number;
    weedThreshold: number;
    onWatchList: boolean;
    starting: number;
    interventions: { id: string; label: string }[];
  } | null>(null);

  const snap = q.data;
  const s = snap?.students.find((x) => x.id === studentId);

  useEffect(() => {
    if (!snap || !s) return;
    void (async () => {
      try {
        const { settings } = await getBehaviourSettings({
          data: { schoolId: snap.school.id },
        });
        const enabled = Boolean(settings.enabled);
        const starting = Number(settings.starting_points ?? 10);
        const weed = Number(settings.weed_threshold ?? -50);
        const sum = snap.behaviour
          .filter((b) => b.student_id === s.id)
          .reduce((a, b) => a + Number(b.points || 0), 0);
        const score = starting + sum;
        let interventions: { id: string; label: string }[] = [];
        const raw = settings.interventions;
        if (Array.isArray(raw)) interventions = raw as { id: string; label: string }[];
        else if (typeof raw === "string") {
          try {
            interventions = JSON.parse(raw);
          } catch {
            interventions = [];
          }
        }
        setBehaviour({
          enabled,
          score,
          weedThreshold: weed,
          onWatchList: enabled && score <= weed,
          starting,
          interventions,
        });
      } catch {
        setBehaviour({
          enabled: false,
          score: 10,
          weedThreshold: -50,
          onWatchList: false,
          starting: 10,
          interventions: [],
        });
      }
    })();
  }, [snap, s?.id]);

  if (q.isPending) return <Skeleton className="h-80" />;
  if (!snap) return null;
  if (!s) {
    return (
      <div>
        <p>Student not found.</p>
        <Link to="/app/students" className="text-sm text-primary hover:underline">
          Back to students
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
      link: l,
      parent: snap.parents.find((p) => p.id === l.parent_id),
    }));
  const charges = snap.charges.filter((c) => c.student_id === s.id);
  const behaviourRows = snap.behaviour.filter((b) => b.student_id === s.id);

  // All results grouped by term
  const byTerm = new Map<string, typeof snap.results>();
  for (const r of snap.results.filter((r) => r.student_id === s.id)) {
    if (!byTerm.has(r.term_id)) byTerm.set(r.term_id, []);
    byTerm.get(r.term_id)!.push(r);
  }
  const termIds = [...byTerm.keys()];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker={s.admission_number}
        title={studentName(s)}
        description={`${classLabel(classById(snap, s.class_id))} · ${
          s.gender === "F" ? "Female" : s.gender === "M" ? "Male" : "—"
        } · born ${formatDate(s.date_of_birth)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link to="/app/students">Back</Link>
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  if (!term) {
                    toast.error("No published term for report card");
                    return;
                  }
                  const rc = await generateReportCard({
                    data: {
                      schoolId: snap.school.id,
                      studentId: s.id,
                      termId: term.id,
                    },
                  });
                  const w = window.open("", "_blank", "width=720,height=900");
                  if (!w || !rc.school) return;
                  const color = rc.school.primary_color || "#0f766e";
                  const rows = (rc.results || [])
                    .map(
                      (r: {
                        subject: string;
                        code?: string;
                        score?: number;
                        grade?: string;
                      }) =>
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
                  @media print{button{display:none}}
                </style></head><body>
                <h1>${rc.school.name}</h1>
                <p class="muted">${rc.school.motto || ""}</p>
                <h2>Report card — ${rc.term}</h2>
                <p><strong>${rc.student.name}</strong> · ${rc.student.admission_number}</p>
                <table><thead><tr><th>Subject</th><th>Code</th><th>Score</th><th>Grade</th></tr></thead>
                <tbody>${rows}</tbody></table>
                <p>Average: <strong>${rc.average ?? "—"}</strong>
                ${rc.position != null ? ` · Position: <strong>${rc.position}</strong>` : ""}</p>
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
                  w.document.write(`<!DOCTYPE html><html><head><title>ID</title>
                  <style>body{font-family:system-ui;padding:16px;border:3px solid ${color}}
                  h1{font-size:16px;color:${color};margin:0}</style></head><body>
                  <h1>${card.school.name}</h1>
                  <p><strong>${card.student.name}</strong><br/>${card.student.admission_number}
                  <br/>${card.student.classLabel || ""}</p>
                  <button onclick="window.print()">Print</button>
                  </body></html>`);
                  w.document.close();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              ID card
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Status" value={s.status} />
        <Stat label="Attendance" value={pct(studentAttendance(snap, s.id))} />
        <Stat label="Balance" value={money(studentBalance(snap, s.id))} />
        <Stat
          label="Term avg"
          value={
            avg != null
              ? `${pct(avg)}${pos != null ? ` · #${pos}` : ""}`
              : "—"
          }
        />
      </div>

      {/* Behaviour points */}
      <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Behaviour</h2>
        {!behaviour?.enabled ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Behaviour points are <strong>off</strong> for this school (default). Turn the module
            on under Behaviour settings when you want starting points, rewards, watch lists, and
            year-end ranking.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-3xl font-semibold tabular-nums">
              {behaviour.score}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                points (starts at {behaviour.starting})
              </span>
            </p>
            {behaviour.onWatchList ? (
              <p className="rounded-md bg-amber-500/15 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
                On watch / intervention list (at or below {behaviour.weedThreshold}). Suggested
                actions:{" "}
                {behaviour.interventions.map((i) => i.label).join(" · ") ||
                  "as defined by the school"}
                .
              </p>
            ) : null}
            <ul className="divide-y divide-border text-sm">
              {behaviourRows.length === 0 ? (
                <li className="py-2 text-muted-foreground">No behaviour records yet.</li>
              ) : (
                behaviourRows.map((b) => (
                  <li key={b.id} className="flex flex-wrap justify-between gap-2 py-2">
                    <span>
                      <StatusPill value={b.kind} /> {b.category}
                      {b.description ? ` — ${b.description}` : ""}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {Number(b.points) > 0 ? "+" : ""}
                      {b.points} · {formatDate(b.date)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </section>

      {/* Results all terms */}
      <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Examination & assessment results</h2>
        <p className="text-sm text-muted-foreground">
          All recorded marks for this student by term (published and in progress).
        </p>
        {termIds.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No results recorded yet.</p>
        ) : (
          termIds.map((tid) => {
            const termRow = snap.terms.find((x) => x.id === tid);
            const rows = byTerm.get(tid)!;
            return (
              <div key={tid} className="mt-4">
                <h3 className="text-sm font-semibold">
                  {termRow?.name || tid}
                  {termRow?.status ? ` · ${termRow.status}` : ""}
                </h3>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full min-w-[400px] text-left text-sm">
                    <thead className="text-[11px] uppercase text-muted-foreground">
                      <tr>
                        <th className="py-1 pr-2">Subject</th>
                        <th className="py-1 pr-2">CA</th>
                        <th className="py-1 pr-2">Exam</th>
                        <th className="py-1 pr-2">Overall</th>
                        <th className="py-1">Grade</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-t border-border">
                          <td className="py-1.5 pr-2">
                            {snap.subjects.find((x) => x.id === r.subject_id)?.name || "—"}
                          </td>
                          <td className="py-1.5 pr-2 tabular-nums">{num(r.continuous_score)}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{num(r.exam_score)}</td>
                          <td className="py-1.5 pr-2 tabular-nums">{num(r.overall_score)}</td>
                          <td className="py-1.5">{r.grade || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })
        )}
      </section>

      <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Parents / guardians</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {parents.length === 0 ? (
            <li className="text-muted-foreground">No linked parents.</li>
          ) : (
            parents.map(({ link, parent }) => (
              <li key={link.id}>
                {parent ? `${parent.first_name} ${parent.last_name}` : "—"}
                {parent?.phone ? ` · ${parent.phone}` : ""}
                {parent?.email ? ` · ${parent.email}` : ""}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Fees</h2>
        <ul className="mt-2 divide-y divide-border text-sm">
          {charges.length === 0 ? (
            <li className="py-2 text-muted-foreground">No charges.</li>
          ) : (
            charges.map((c) => (
              <li key={c.id} className="flex justify-between py-2">
                <span>{c.description}</span>
                <span className="tabular-nums">
                  {money(c.amount)} · paid {money(c.paid)} · {c.status}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-medium">{value}</p>
    </div>
  );
}
