import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { advanceSubmission, checkStudentResultAccess, publishResults, saveMarks } from "@/lib/nexus/server";
import {
  classById,
  classLabel,
  currentTerm,
  defaultParent,
  parentChildren,
  publishedTerm,
  studentAverage,
  studentPosition,
} from "@/lib/nexus/selectors";
import { num, pct, studentName } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";
import type { ResultSubmission, Snapshot } from "@/lib/nexus/types";

export const Route = createFileRoute("/app/results")({ component: ResultsPage });

function ResultsPage() {
  const q = useSnapshot();
  const persona = useNexusSession((s) => s.persona);
  if (q.isPending) return <Skeleton className="h-80" />;
  if (!q.data) return null;
  if (persona === "parent") return <ParentResults snap={q.data} />;
  return <StaffResults snap={q.data} persona={persona} />;
}

function ParentResults({ snap }: { snap: Snapshot }) {
  const parent = defaultParent(snap);
  const children = parent ? parentChildren(snap, parent.id) : [];
  const term = publishedTerm(snap);
  const [locks, setLocks] = useState<Record<string, { allowed: boolean; reason?: string }>>({});

  useEffect(() => {
    if (!term || !children.length) return;
    let cancelled = false;
    void (async () => {
      const next: Record<string, { allowed: boolean; reason?: string }> = {};
      for (const c of children) {
        if (!c.class_id) {
          next[c.id] = { allowed: true };
          continue;
        }
        try {
          const r = await checkStudentResultAccess({
            data: {
              schoolId: snap.school.id,
              studentId: c.id,
              classId: c.class_id,
              termId: term.id,
            },
          });
          next[c.id] = { allowed: r.allowed, reason: r.reason };
        } catch {
          next[c.id] = { allowed: true };
        }
      }
      if (!cancelled) setLocks(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [term?.id, children.map((c) => c.id).join(","), snap.school.id]);

  return (
    <div>
      <h1 className="font-display text-3xl text-foam">Published results</h1>
      <p className="mt-1 text-sm text-mist">
        Only packets the school has published appear here. Access may depend on fee clearance set by the school.
      </p>
      <div className="mt-6 space-y-5">
        {children.map((c) => {
          const lock = locks[c.id];
          const blocked = lock && lock.allowed === false;
          const rows =
            term && !blocked
              ? snap.results.filter(
                  (r) =>
                    r.student_id === c.id && r.term_id === term.id && r.status === "PUBLISHED",
                )
              : [];
          const avg = term && !blocked ? studentAverage(snap, c.id, term.id, true) : null;
          const pos = term && !blocked ? studentPosition(snap, c.id, term.id) : null;
          const peers = snap.students.filter((s) => s.class_id === c.class_id).length;
          return (
            <section key={c.id} className="rounded-xl border border-foam/10 bg-ink-2 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-2xl text-foam">{studentName(c)}</h2>
                <p className="tabular-nums text-sm text-mist">
                  {avg != null ? pct(avg) : "—"}
                  {pos ? ` · ${pos}/${peers}` : ""}
                </p>
              </div>
              <ul className="mt-3 divide-y divide-foam/10">
                {rows.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm text-foam">
                    <span>{snap.subjects.find((s) => s.id === r.subject_id)?.name}</span>
                    <span className="tabular-nums">
                      {num(r.overall_score)}% {r.grade}
                    </span>
                  </li>
                ))}
                {blocked ? (
                  <li className="py-2 text-sm text-amber-200/90">
                    {lock?.reason ||
                      "Results are published but locked until required school fees are cleared."}
                  </li>
                ) : rows.length === 0 ? (
                  <li className="py-2 text-sm text-mist">Nothing published for this child.</li>
                ) : null}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StaffResults({ snap, persona }: { snap: Snapshot; persona: string }) {
  const invalidate = useInvalidateSnapshot();
  const term = currentTerm(snap);
  const published = publishedTerm(snap);
  const f2a = snap.classes.find((c) => c.name === "Form 2" && c.stream === "A");
  const packets = snap.submissions.filter((s) => s.class_id === f2a?.id && s.term_id === term?.id);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accessMode, setAccessMode] = useState<"ALL" | "FEE_CRITERIA">("ALL");
  const [selectedFeeIds, setSelectedFeeIds] = useState<string[]>([]);


  const allReady = packets.every((p) => p.status === "APPROVED" || p.status === "READY_TO_PUBLISH" || p.status === "PUBLISHED");
  const already = packets.every((p) => p.status === "PUBLISHED");

  async function act(sub: ResultSubmission, action: "submit" | "review" | "verify" | "approve" | "return") {
    try {
      const res = await advanceSubmission({ data: { submissionId: sub.id, action } });
      toast.success(`Now ${res.status.replaceAll("_", " ").toLowerCase()}`);
      await invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Examination office"
        title={`${classLabel(f2a)} · ${term?.name}`}
        description="Draft marks are invisible to parents. Publication is a separate, auditable action."
        actions={
          persona !== "teacher" ? (
            <Button disabled={!allReady || already} onClick={() => setConfirm(true)}>
              {already ? "Published" : "Publish…"}
            </Button>
          ) : null
        }
      />
      <div className="space-y-4">
        {packets.map((p) => (
          <PacketCard
            key={p.id}
            snap={snap}
            packet={p}
            onAct={act}
            persona={persona}
            onSaved={invalidate}
          />
        ))}
      </div>
      {published && f2a ? (
        <section className="mt-8 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Published · {published.name}</h2>
          <ClassTable snap={snap} classId={f2a.id} termId={published.id} onlyPublished />
        </section>
      ) : null}

      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Publish results</DialogTitle>
            <DialogDescription>
              {term?.name} · {classLabel(f2a)} ·{" "}
              {snap.students.filter((s) => s.class_id === f2a?.id).length} students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Choose who can see these results in the parent app. You can require clearance on
              specific fee types from your fee structure (e.g. school fees only, or school + exam fees).
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="accessMode"
                  checked={accessMode === "ALL"}
                  onChange={() => setAccessMode("ALL")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">All linked parents</span>
                  <span className="block text-xs text-muted-foreground">
                    Everyone with a linked child in this class can view results.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="accessMode"
                  checked={accessMode === "FEE_CRITERIA"}
                  onChange={() => setAccessMode("FEE_CRITERIA")}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">Only if selected fees are cleared</span>
                  <span className="block text-xs text-muted-foreground">
                    Parent sees results only when the student has no outstanding balance on each
                    fee type you tick below.
                  </span>
                </span>
              </label>
            </div>
            {accessMode === "FEE_CRITERIA" && (
              <div className="rounded-lg border border-border p-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Fee criteria (tick the ones that must be paid)
                </p>
                {snap.fees.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No fee structures yet. Add them under Finance first.
                  </p>
                ) : (
                  <ul className="max-h-48 space-y-2 overflow-y-auto">
                    {snap.fees.map((f) => (
                      <li key={f.id}>
                        <label className="flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={selectedFeeIds.includes(f.id)}
                            onChange={() => {
                              setSelectedFeeIds((prev) =>
                                prev.includes(f.id)
                                  ? prev.filter((id) => id !== f.id)
                                  : [...prev, f.id],
                              );
                            }}
                          />
                          <span>
                            <span className="font-medium">{f.name}</span>
                            <span className="block text-xs text-muted-foreground tabular-nums">
                              {Number(f.amount).toLocaleString()} {snap.school.currency || "MWK"}
                              {f.mandatory ? " · mandatory" : ""}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Example: tick only “School fees” so exam fee arrears do not block results. Or tick
                  both. Inactive (unticked) fee types are ignored for this publish.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                if (!f2a || !term) return;
                setBusy(true);
                try {
                  const res = await publishResults({
                    data: {
                      classId: f2a.id,
                      termId: term.id,
                      actor: "Results office",
                      accessMode,
                      requiredFeeStructureIds:
                        accessMode === "FEE_CRITERIA" ? selectedFeeIds : [],
                    },
                  });
                  toast.success(`Published for ${res.students} students`);
                  setConfirm(false);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Cannot publish yet");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Confirm & publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PacketCard({
  snap,
  packet,
  onAct,
  persona,
  onSaved,
}: {
  snap: Snapshot;
  packet: ResultSubmission;
  onAct: (p: ResultSubmission, a: "submit" | "review" | "verify" | "approve" | "return") => void;
  persona: string;
  onSaved: () => void;
}) {
  const subject = snap.subjects.find((s) => s.id === packet.subject_id);
  const roster = snap.students.filter((s) => s.class_id === packet.class_id);
  const canEdit = packet.status === "DRAFT" || packet.status === "RETURNED";
  return (
    <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl">{subject?.name}</h2>
          <p className="text-xs text-muted-foreground">
            Continuous 40% · Examination 60%
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill value={packet.status} />
          {canEdit && (persona === "teacher" || persona === "owner") ? (
            <Button size="sm" onClick={() => onAct(packet, "submit")}>
              Submit
            </Button>
          ) : null}
          {packet.status === "SUBMITTED" && persona !== "teacher" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onAct(packet, "return")}>
                Return
              </Button>
              <Button size="sm" onClick={() => onAct(packet, "verify")}>
                Verify
              </Button>
            </>
          ) : null}
          {packet.status === "VERIFIED" && (persona === "head" || persona === "owner" || persona === "exam") ? (
            <Button size="sm" onClick={() => onAct(packet, "approve")}>
              Approve
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="py-2 font-medium">Student</th>
              <th className="py-2 font-medium">CA</th>
              <th className="py-2 font-medium">Exam</th>
              <th className="py-2 font-medium">Overall</th>
              <th className="py-2 font-medium">Grade</th>
            </tr>
          </thead>
          <tbody>
            {roster.map((st) => {
              const r = snap.results.find(
                (x) => x.student_id === st.id && x.subject_id === packet.subject_id && x.term_id === packet.term_id,
              );
              if (!r) return null;
              return (
                <MarkRow key={st.id} name={studentName(st)} resultId={r.id} ca={num(r.continuous_score)} exam={num(r.exam_score)} overall={num(r.overall_score)} grade={r.grade ?? "—"} editable={canEdit && (persona === "teacher" || persona === "owner")} onSaved={onSaved} />
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MarkRow({
  name,
  resultId,
  ca,
  exam,
  overall,
  grade,
  editable,
  onSaved,
}: {
  name: string;
  resultId: string;
  ca: number;
  exam: number;
  overall: number;
  grade: string;
  editable: boolean;
  onSaved: () => void;
}) {
  const [c, setC] = useState(String(ca));
  const [e, setE] = useState(String(exam));
  const dirty = useMemo(() => Number(c) !== ca || Number(e) !== exam, [c, e, ca, exam]);
  return (
    <tr className="border-t border-border">
      <td className="py-2">{name}</td>
      <td className="py-2">
        {editable ? (
          <Input className="h-8 w-16" value={c} onChange={(ev) => setC(ev.target.value)} />
        ) : (
          <span className="tabular-nums">{ca}</span>
        )}
      </td>
      <td className="py-2">
        {editable ? (
          <Input className="h-8 w-16" value={e} onChange={(ev) => setE(ev.target.value)} />
        ) : (
          <span className="tabular-nums">{exam}</span>
        )}
      </td>
      <td className="py-2 tabular-nums">{overall}</td>
      <td className="py-2">
        {grade}
        {editable && dirty ? (
          <Button
            size="sm"
            variant="ghost"
            className="ml-2"
            onClick={async () => {
              await saveMarks({
                data: { resultId, continuous: Number(c), exam: Number(e) },
              });
              toast.success("Saved");
              onSaved();
            }}
          >
            Save
          </Button>
        ) : null}
      </td>
    </tr>
  );
}

function ClassTable({
  snap,
  classId,
  termId,
  onlyPublished,
}: {
  snap: Snapshot;
  classId: string;
  termId: string;
  onlyPublished?: boolean;
}) {
  const roster = snap.students.filter((s) => s.class_id === classId);
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
          <tr>
            <th className="py-2 font-medium">Student</th>
            <th className="py-2 font-medium">Average</th>
            <th className="py-2 font-medium">Position</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((s) => (
            <tr key={s.id} className="border-t border-border">
              <td className="py-2">{studentName(s)}</td>
              <td className="py-2 tabular-nums">
                {pct(studentAverage(snap, s.id, termId, onlyPublished) ?? 0)}
              </td>
              <td className="py-2 tabular-nums">{studentPosition(snap, s.id, termId) ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
