import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { markAttendance } from "@/lib/nexus/server";
import { enqueueOffline, isBrowserOffline } from "@/lib/offline/queue";
import {
  attendanceRate,
  classById,
  classLabel,
  defaultParent,
  parentChildren,
  todayIso,
} from "@/lib/nexus/selectors";
import { studentName as nameOf } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";
import type { AttendanceStatus, Student } from "@/lib/nexus/types";

export const Route = createFileRoute("/app/attendance")({ component: AttendancePage });

const STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

function AttendancePage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const persona = useNexusSession((s) => s.persona);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  const date = todayIso();

  if (persona === "parent") {
    const parent = defaultParent(snap);
    const children = parent ? parentChildren(snap, parent.id) : [];
    return (
      <div>
        <h1 className="font-display text-3xl text-foam">Attendance</h1>
        <p className="mt-1 text-sm text-mist">
          Absence alerts go to verified phones when the school policy says so.
        </p>
        <div className="mt-6 space-y-4">
          {children.map((c) => {
            const rows = snap.attendance.filter((a) => a.student_id === c.id);
            return (
              <div key={c.id} className="rounded-xl border border-foam/10 bg-ink-2 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-display text-xl text-foam">{nameOf(c)}</p>
                  <p className="tabular-nums text-sm text-mist">{attendanceRate(rows)}%</p>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {rows
                    .slice()
                    .reverse()
                    .map((r) => (
                      <span
                        key={r.id}
                        title={`${r.date} ${r.status}`}
                        className={
                          r.status === "PRESENT"
                            ? "grid size-7 place-items-center rounded-sm bg-ok/40 text-[10px] text-foam"
                            : r.status === "ABSENT"
                              ? "grid size-7 place-items-center rounded-sm bg-destructive/40 text-[10px] text-foam"
                              : "grid size-7 place-items-center rounded-sm bg-warn/40 text-[10px] text-foam"
                        }
                      >
                        {r.status[0]}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const f2a = snap.classes.find((c) => c.name === "Form 2" && c.stream === "A");
  const classId = f2a?.id ?? snap.classes[0]?.id;
  const roster = snap.students.filter((s) => s.class_id === classId);

  async function setStatus(student: Student, status: AttendanceStatus) {
    const payload = {
      studentId: student.id,
      date,
      status,
      classId: student.class_id ?? undefined,
    };
    if (isBrowserOffline()) {
      enqueueOffline({
        action: "markAttendance",
        payload,
        label: `Attendance ${nameOf(student)} → ${status}`,
      });
      toast.message("Offline — attendance queued. It will sync when you are back online.");
      return;
    }
    try {
      await markAttendance({ data: payload });
      toast.success(`${nameOf(student)} · ${status.toLowerCase()}`);
      await invalidate();
    } catch (e) {
      if (isBrowserOffline()) {
        enqueueOffline({
          action: "markAttendance",
          payload,
          label: `Attendance ${nameOf(student)} → ${status}`,
        });
        toast.message("Saved to offline queue");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Register"
        title={`${classLabel(classById(snap, classId))} · today`}
        description="Changing a mark writes the register immediately. Offline marks are queued on this device."
      />
      <div className="space-y-2">
        {roster.map((s) => {
          const row = snap.attendance.find((a) => a.student_id === s.id && a.date === date);
          return (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-border)] sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{nameOf(s)}</p>
                <p className="text-xs text-muted-foreground">{s.admission_number}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((st) => (
                  <Button
                    key={st}
                    size="sm"
                    variant={row?.status === st ? "default" : "outline"}
                    onClick={() => setStatus(s, st)}
                  >
                    {st.slice(0, 1) + st.slice(1).toLowerCase()}
                  </Button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Recent absences</h2>
        <ul className="mt-3 space-y-2">
          {snap.attendance
            .filter((a) => a.status === "ABSENT")
            .slice(0, 5)
            .map((a) => {
              const s = snap.students.find((x) => x.id === a.student_id);
              return (
                <li key={a.id} className="flex items-center justify-between text-sm">
                  <span>
                    {s ? nameOf(s) : "Student"} · {a.date}
                  </span>
                  <StatusPill value="ABSENT" />
                </li>
              );
            })}
        </ul>
      </div>
    </div>
  );
}
