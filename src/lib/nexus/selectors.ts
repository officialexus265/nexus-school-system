import { num, studentName } from "@/lib/utils";
import type {
  Attendance,
  ClassRow,
  Parent,
  Snapshot,
  Student,
  StudentCharge,
  StudentResult,
  Subject,
  Term,
} from "./types";

export function classLabel(c: ClassRow | undefined | null): string {
  if (!c) return "Unplaced";
  return c.stream ? `${c.name} ${c.stream}` : c.name;
}

export function classById(snap: Snapshot, id: string | null | undefined) {
  return snap.classes.find((c) => c.id === id);
}

export function subjectById(snap: Snapshot, id: string | null | undefined) {
  return snap.subjects.find((s) => s.id === id);
}

export function studentById(snap: Snapshot, id: string) {
  return snap.students.find((s) => s.id === id);
}

export function currentTerm(snap: Snapshot): Term | undefined {
  return snap.terms.find((t) => t.is_current) ?? snap.terms[snap.terms.length - 1];
}

export function publishedTerm(snap: Snapshot): Term | undefined {
  return snap.terms.find((t) => !t.is_current) ?? snap.terms[0];
}

export function attendanceRate(rows: Attendance[]): number {
  if (rows.length === 0) return 0;
  const ok = rows.filter((r) => r.status === "PRESENT" || r.status === "LATE" || r.status === "EXCUSED").length;
  return Math.round((ok / rows.length) * 100);
}

export function studentAttendance(snap: Snapshot, studentId: string): number {
  return attendanceRate(snap.attendance.filter((a) => a.student_id === studentId));
}

export function studentAverage(
  snap: Snapshot,
  studentId: string,
  termId: string,
  onlyPublished = false,
): number | null {
  const rows = snap.results.filter(
    (r) =>
      r.student_id === studentId &&
      r.term_id === termId &&
      (!onlyPublished || r.status === "PUBLISHED" || r.status === "LOCKED"),
  );
  if (rows.length === 0) return null;
  return Math.round((rows.reduce((a, r) => a + num(r.overall_score), 0) / rows.length) * 10) / 10;
}

export function studentPosition(snap: Snapshot, studentId: string, termId: string): number | null {
  const row = snap.results.find((r) => r.student_id === studentId && r.term_id === termId && r.position);
  return row?.position ?? null;
}

export function chargeBalance(c: StudentCharge): number {
  return Math.max(0, num(c.amount) - num(c.paid));
}

export function studentBalance(snap: Snapshot, studentId: string): number {
  return snap.charges.filter((c) => c.student_id === studentId).reduce((a, c) => a + chargeBalance(c), 0);
}

export function schoolOutstanding(snap: Snapshot): number {
  return snap.charges.reduce((a, c) => a + chargeBalance(c), 0);
}

export function schoolCollected(snap: Snapshot): number {
  return snap.charges.reduce((a, c) => a + num(c.paid), 0);
}

export function parentChildren(snap: Snapshot, parentId: string): Student[] {
  const ids = new Set(snap.parentLinks.filter((l) => l.parent_id === parentId).map((l) => l.student_id));
  return snap.students.filter((s) => ids.has(s.id));
}

export function defaultParent(snap: Snapshot): Parent | undefined {
  return (
    snap.parents.find((p) => p.full_name.includes("Agnes")) ?? snap.parents[0]
  );
}

export function defaultTeacher(snap: Snapshot) {
  return snap.staff.find((s) => s.full_name.includes("James Banda")) ?? snap.staff.find((s) => s.role === "teacher");
}

export function teacherClassIds(snap: Snapshot, staffId: string): string[] {
  return [...new Set(snap.assignments.filter((a) => a.staff_id === staffId).map((a) => a.class_id))];
}

export function resultsForStudent(
  snap: Snapshot,
  studentId: string,
  termId: string,
  subjects: Subject[],
): { subject: Subject; result: StudentResult | undefined }[] {
  return subjects
    .map((subject) => ({
      subject,
      result: snap.results.find(
        (r) => r.student_id === studentId && r.term_id === termId && r.subject_id === subject.id,
      ),
    }))
    .filter((x) => x.result);
}

export function displayName(s: Student): string {
  return studentName(s);
}

export function todayIso(): string {
  return "2026-09-15";
}
