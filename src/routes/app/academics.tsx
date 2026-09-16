import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  createAssessment,
  createExamination,
  ensureGradingScale,
  listExaminations,
  promoteStudents,
  recalculateRankings,
  updateGradingScale,
  updateRankingSettings,
} from "@/lib/nexus/server";
import { classById, classLabel, currentTerm } from "@/lib/nexus/selectors";
import { formatDate, num, studentName } from "@/lib/utils";

export const Route = createFileRoute("/app/academics")({ component: AcademicsPage });

function AcademicsPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const [scale, setScale] = useState<{
    continuous_weight: number;
    exam_weight: number;
    bands: { grade: string; min_score: number; max_score: number; remark: string | null }[];
  } | null>(null);
  const [cw, setCw] = useState(40);
  const [ew, setEw] = useState(60);
  const [rankEnabled, setRankEnabled] = useState(true);
  const [rankParents, setRankParents] = useState(true);
  const [exams, setExams] = useState<{ id: string; name: string; status: string; start_date: string | null }[]>([]);

  // Assessment form
  const [aName, setAName] = useState("");
  const [aType, setAType] = useState("Test");
  const [aClass, setAClass] = useState("");
  const [aSubject, setASubject] = useState("");
  const [aMax, setAMax] = useState("100");

  // Exam form
  const [eName, setEName] = useState("");
  const [eClass, setEClass] = useState("");

  // Promote
  const [fromClass, setFromClass] = useState("");
  const [toClass, setToClass] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [promoAction, setPromoAction] = useState<
    "PROMOTED" | "REPEATED" | "TRANSFERRED" | "GRADUATED" | "WITHDRAWN"
  >("PROMOTED");

  useEffect(() => {
    if (!q.data?.school) return;
    const sid = q.data.school.id;
    ensureGradingScale({ data: { schoolId: sid } })
      .then((r) => {
        setScale({
          continuous_weight: Number(r.scale.continuous_weight),
          exam_weight: Number(r.scale.exam_weight),
          bands: r.bands.map((b) => ({
            grade: b.grade,
            min_score: Number(b.min_score),
            max_score: Number(b.max_score),
            remark: b.remark,
          })),
        });
        setCw(Number(r.scale.continuous_weight));
        setEw(Number(r.scale.exam_weight));
      })
      .catch(() => {});
    listExaminations({ data: { schoolId: sid } })
      .then((r) => setExams(r.exams))
      .catch(() => {});
  }, [q.data?.school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  const term = currentTerm(snap);

  const fromStudents = fromClass
    ? snap.students.filter((s) => s.class_id === fromClass && s.status === "ACTIVE")
    : [];

  return (
    <div>
      <PageHeader
        kicker="Structure"
        title="Academics"
        description="Classes, assessments, grading scales, exams, ranking and promotions."
      />

      <Tabs defaultValue="structure">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="structure">Structure</TabsTrigger>
          <TabsTrigger value="assessments">Assessments</TabsTrigger>
          <TabsTrigger value="grading">Grading & rank</TabsTrigger>
          <TabsTrigger value="exams">Exams</TabsTrigger>
          <TabsTrigger value="promote">Promote / transfer</TabsTrigger>
        </TabsList>

        <TabsContent value="structure" className="mt-4">
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
              <h2 className="font-display text-xl">Subjects</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {snap.subjects.map((s) => (
                  <span key={s.id} className="rounded-lg bg-secondary px-3 py-1.5 text-sm">
                    {s.name}
                    {s.code ? ` (${s.code})` : ""}
                  </span>
                ))}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="assessments" className="mt-4 space-y-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Create assessment</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={aName} onChange={(e) => setAName(e.target.value)} placeholder="Mid-term test" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={aType}
                  onChange={(e) => setAType(e.target.value)}
                >
                  {["Assignment", "Quiz", "Test", "Project", "Practical", "Midterm", "Continuous"].map(
                    (t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ),
                  )}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Max marks</Label>
                <Input type="number" value={aMax} onChange={(e) => setAMax(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Class</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={aClass}
                  onChange={(e) => setAClass(e.target.value)}
                >
                  <option value="">Select…</option>
                  {snap.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Subject</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={aSubject}
                  onChange={(e) => setASubject(e.target.value)}
                >
                  <option value="">Select…</option>
                  {snap.subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={async () => {
                if (!aName || !aClass || !aSubject) {
                  toast.error("Name, class and subject required");
                  return;
                }
                try {
                  await createAssessment({
                    data: {
                      schoolId: snap.school.id,
                      classId: aClass,
                      subjectId: aSubject,
                      termId: term?.id,
                      name: aName,
                      assessmentType: aType,
                      maximumMarks: Number(aMax) || 100,
                    },
                  });
                  toast.success("Assessment created");
                  setAName("");
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Create
            </Button>
          </section>
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Existing assessments</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="py-2">Name</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Class</th>
                    <th className="py-2">Subject</th>
                    <th className="py-2">Max</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.assessments.map((a) => (
                    <tr key={a.id} className="border-t border-border">
                      <td className="py-2">{a.name}</td>
                      <td className="py-2">{a.assessment_type}</td>
                      <td className="py-2">{classLabel(classById(snap, a.class_id))}</td>
                      <td className="py-2">
                        {snap.subjects.find((s) => s.id === a.subject_id)?.name}
                      </td>
                      <td className="py-2 tabular-nums">{a.maximum_marks}</td>
                      <td className="py-2">
                        <StatusPill value={a.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="grading" className="mt-4 space-y-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Grade weights</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Continuous assessment vs final exam contribution to overall score.
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label>Continuous %</Label>
                <Input
                  type="number"
                  value={cw}
                  onChange={(e) => setCw(Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Exam %</Label>
                <Input
                  type="number"
                  value={ew}
                  onChange={(e) => setEw(Number(e.target.value))}
                  className="w-28"
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={async () => {
                    try {
                      await updateGradingScale({
                        data: {
                          schoolId: snap.school.id,
                          continuousWeight: cw,
                          examWeight: ew,
                        },
                      });
                      toast.success("Weights saved");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Save weights
                </Button>
              </div>
            </div>
            {scale && (
              <table className="mt-6 w-full max-w-md text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1">Grade</th>
                    <th className="py-1">Range</th>
                    <th className="py-1">Remark</th>
                  </tr>
                </thead>
                <tbody>
                  {scale.bands.map((b) => (
                    <tr key={b.grade} className="border-t border-border">
                      <td className="py-1 font-medium">{b.grade}</td>
                      <td className="py-1 tabular-nums">
                        {b.min_score}–{b.max_score}
                      </td>
                      <td className="py-1 text-muted-foreground">{b.remark}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Ranking</h2>
            <div className="mt-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rankEnabled}
                  onChange={(e) => setRankEnabled(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Enable class ranking
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={rankParents}
                  onChange={(e) => setRankParents(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Show position to parents
              </label>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await updateRankingSettings({
                      data: {
                        schoolId: snap.school.id,
                        enabled: rankEnabled,
                        showToParents: rankParents,
                      },
                    });
                    toast.success("Ranking settings saved");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Save ranking settings
              </Button>
              {term &&
                snap.classes.map((c) => (
                  <Button
                    key={c.id}
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const r = await recalculateRankings({
                          data: {
                            schoolId: snap.school.id,
                            termId: term.id,
                            classId: c.id,
                          },
                        });
                        toast.success(`Ranked ${r.rankedStudents} in ${classLabel(c)}`);
                        await invalidate();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Rank {classLabel(c)}
                  </Button>
                ))}
            </div>
          </section>
        </TabsContent>

        <TabsContent value="exams" className="mt-4 space-y-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Create examination</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={eName}
                  onChange={(e) => setEName(e.target.value)}
                  placeholder="End of Term 2 Examinations"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Primary class (optional)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={eClass}
                  onChange={(e) => setEClass(e.target.value)}
                >
                  <option value="">All / unspecified</option>
                  {snap.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={async () => {
                if (!eName) {
                  toast.error("Name required");
                  return;
                }
                try {
                  await createExamination({
                    data: {
                      schoolId: snap.school.id,
                      name: eName,
                      termId: term?.id,
                      classId: eClass || undefined,
                      subjectIds: snap.subjects.map((s) => s.id),
                    },
                  });
                  toast.success("Examination created");
                  setEName("");
                  const r = await listExaminations({ data: { schoolId: snap.school.id } });
                  setExams(r.exams);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Create exam period
            </Button>
          </section>
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Examination periods</h2>
            <ul className="mt-3 divide-y divide-border">
              {exams.map((ex) => (
                <li key={ex.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{ex.name}</span>
                  <StatusPill value={ex.status} />
                </li>
              ))}
              {exams.length === 0 && (
                <li className="py-2 text-sm text-muted-foreground">No examinations yet.</li>
              )}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="promote" className="mt-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Promote / transfer / graduate</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>From class</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={fromClass}
                  onChange={(e) => {
                    setFromClass(e.target.value);
                    setSelected([]);
                  }}
                >
                  <option value="">Select…</option>
                  {snap.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>To class</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={toClass}
                  onChange={(e) => setToClass(e.target.value)}
                >
                  <option value="">—</option>
                  {snap.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Action</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={promoAction}
                  onChange={(e) =>
                    setPromoAction(e.target.value as typeof promoAction)
                  }
                >
                  <option value="PROMOTED">Promoted</option>
                  <option value="REPEATED">Repeated</option>
                  <option value="TRANSFERRED">Transferred</option>
                  <option value="GRADUATED">Graduated</option>
                  <option value="WITHDRAWN">Withdrawn</option>
                </select>
              </div>
            </div>
            {fromClass && (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border border-border p-2">
                {fromStudents.map((st) => (
                  <label
                    key={st.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary"
                  >
                    <input
                      type="checkbox"
                      checked={selected.includes(st.id)}
                      onChange={() =>
                        setSelected((prev) =>
                          prev.includes(st.id)
                            ? prev.filter((x) => x !== st.id)
                            : [...prev, st.id],
                        )
                      }
                      className="size-4 accent-primary"
                    />
                    {studentName(st)} · {st.admission_number}
                  </label>
                ))}
              </div>
            )}
            <Button
              className="mt-4"
              disabled={!selected.length}
              onClick={async () => {
                if (
                  (promoAction === "PROMOTED" ||
                    promoAction === "REPEATED" ||
                    promoAction === "TRANSFERRED") &&
                  !toClass
                ) {
                  toast.error("Select destination class");
                  return;
                }
                try {
                  const r = await promoteStudents({
                    data: {
                      schoolId: snap.school.id,
                      studentIds: selected,
                      toClassId: toClass || null,
                      action: promoAction,
                    },
                  });
                  toast.success(`${promoAction}: ${r.count} student(s)`);
                  setSelected([]);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Apply to {selected.length || 0} student(s)
            </Button>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
