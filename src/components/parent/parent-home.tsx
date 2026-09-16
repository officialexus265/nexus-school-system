import { Link } from "@tanstack/react-router";
import type { Snapshot, Student } from "@/lib/nexus/types";
import {
  classById,
  classLabel,
  defaultParent,
  parentChildren,
  publishedTerm,
  studentAttendance,
  studentAverage,
  studentBalance,
  studentPosition,
} from "@/lib/nexus/selectors";
import { money, pct, studentName } from "@/lib/utils";
import { StatusPill } from "@/components/status-pill";

export function ParentHome({ snap }: { snap: Snapshot }) {
  const parent = defaultParent(snap);
  const children = parent ? parentChildren(snap, parent.id) : [];
  const term = publishedTerm(snap);
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Good afternoon</p>
        <h1 className="mt-1 font-display text-3xl font-medium tracking-tight text-foam">
          {parent?.full_name ?? "Parent"}
        </h1>
        <p className="mt-1 text-sm text-mist">Linked children are verified. Unpublished marks stay hidden.</p>
      </div>
      <div className="space-y-3">
        {children.map((child) => (
          <ChildCard key={child.id} snap={snap} student={child} termId={term?.id} />
        ))}
      </div>
      <section>
        <h2 className="font-display text-xl text-foam">Notices</h2>
        <ul className="mt-3 space-y-3">
          {snap.announcements.slice(0, 3).map((a) => (
            <li key={a.id} className="rounded-xl border border-foam/10 bg-ink-2 p-4">
              <p className="text-sm font-medium text-foam">{a.title}</p>
              <p className="mt-1 text-sm text-mist">{a.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <Link to="/app/finance" className="block rounded-xl border border-foam/10 bg-ink-2 p-4">
        <p className="text-[11px] uppercase tracking-[0.16em] text-mist">Household balance</p>
        <p className="mt-1 font-display text-3xl tabular-nums text-foam">
          {money(children.reduce((a, c) => a + studentBalance(snap, c.id), 0))}
        </p>
        <p className="mt-1 text-xs text-mist">Open the payment centre</p>
      </Link>
    </div>
  );
}

function ChildCard({
  snap,
  student,
  termId,
}: {
  snap: Snapshot;
  student: Student;
  termId?: string;
}) {
  const avg = termId ? studentAverage(snap, student.id, termId, true) : null;
  const pos = termId ? studentPosition(snap, student.id, termId) : null;
  const att = studentAttendance(snap, student.id);
  const peers = snap.students.filter((s) => s.class_id === student.class_id).length;
  const behaviour = snap.behaviour.filter((b) => b.student_id === student.id);
  const tone = behaviour.some((b) => b.kind === "NEGATIVE" && b.status === "OPEN") ? "Watch" : "Good";
  return (
    <div className="rounded-xl border border-foam/10 bg-ink-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl text-foam">{studentName(student)}</p>
          <p className="text-xs text-mist">
            {classLabel(classById(snap, student.class_id))} · {student.admission_number}
          </p>
        </div>
        <StatusPill value={tone === "Good" ? "ACTIVE" : "OPEN"} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-mist">Average</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-foam">
            {avg != null ? pct(avg) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-mist">Attend.</dt>
          <dd className="mt-1 font-display text-2xl tabular-nums text-foam">{pct(att)}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-mist">Behaviour</dt>
          <dd className="mt-1 font-display text-2xl text-foam">{tone}</dd>
        </div>
      </dl>
      {pos ? (
        <p className="mt-3 text-xs text-mist">
          Term 1 position {pos} of {peers}
        </p>
      ) : null}
    </div>
  );
}
