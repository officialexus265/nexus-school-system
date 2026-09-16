import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { addStudent } from "@/lib/nexus/server";
import { classById, classLabel, studentAttendance, studentBalance } from "@/lib/nexus/selectors";
import { money, pct, studentName } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/students")({ component: StudentsPage });

function StudentsPage() {
  const q = useSnapshot();
  const persona = useNexusSession((s) => s.persona);
  const dark = persona === "parent";
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  const students =
    persona === "teacher"
      ? snap.students.filter((s) => {
          const teacher = snap.staff.find((t) => t.full_name.includes("James Banda"));
          const ids = new Set(snap.assignments.filter((a) => a.staff_id === teacher?.id).map((a) => a.class_id));
          return s.class_id && ids.has(s.class_id);
        })
      : snap.students;

  return (
    <div className={dark ? "text-foam" : ""}>
      <PageHeader
        kicker="People"
        title="Students"
        description="Records are archived, not deleted. Historical results and fees remain."
        actions={persona === "parent" ? null : <EnrollDialog schoolId={snap.school.id} classes={snap.classes} />}
      />
      <div className="overflow-x-auto rounded-xl bg-card text-card-foreground shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Student</th>
              <th className="px-4 py-3 font-medium">Admission</th>
              <th className="px-4 py-3 font-medium">Class</th>
              <th className="px-4 py-3 font-medium">Attend.</th>
              <th className="px-4 py-3 font-medium">Balance</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link to="/app/students/$studentId" params={{ studentId: s.id }} className="flex items-center gap-2 hover:underline">
                    <Avatar name={studentName(s)} />
                    <span>{studentName(s)}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">{s.admission_number}</td>
                <td className="px-4 py-3">{classLabel(classById(snap, s.class_id))}</td>
                <td className="px-4 py-3 tabular-nums">{pct(studentAttendance(snap, s.id))}</td>
                <td className="px-4 py-3 tabular-nums">{money(studentBalance(snap, s.id))}</td>
                <td className="px-4 py-3">
                  <StatusPill value={s.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EnrollDialog({
  schoolId,
  classes,
}: {
  schoolId: string;
  classes: { id: string; name: string; stream: string | null }[];
}) {
  const invalidate = useInvalidateSnapshot();
  const [open, setOpen] = useState(false);
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [gender, setGender] = useState("F");
  const [classId, setClass] = useState(classes[0]?.id ?? "");
  const [admission, setAdm] = useState("SA-2026-");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Enrol student</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enrol a student</DialogTitle>
          <DialogDescription>Creates an ACTIVE record. Nothing is physically deleted later.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>First name</Label>
            <Input value={firstName} onChange={(e) => setFirst(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Last name</Label>
            <Input value={lastName} onChange={(e) => setLast(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Admission no.</Label>
            <Input value={admission} onChange={(e) => setAdm(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gender</Label>
            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="F">Female</SelectItem>
                <SelectItem value="M">Male</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClass}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.stream ? `${c.name} ${c.stream}` : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !firstName.trim() || !lastName.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await addStudent({
                  data: {
                    schoolId,
                    firstName,
                    lastName,
                    gender,
                    classId,
                    admissionNumber: admission,
                  },
                });
                toast.success(`Enrolled ${firstName} ${lastName}`);
                setOpen(false);
                setFirst("");
                setLast("");
                await invalidate();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not enrol");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? "Saving…" : "Enrol"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
