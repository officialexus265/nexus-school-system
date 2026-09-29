import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import {
  addStudent,
  bulkImportParents,
  bulkImportStudents,
  deleteStudentRecord,
  updateStudentRecord,
} from "@/lib/nexus/server";
import { classById, classLabel, studentAttendance, studentBalance } from "@/lib/nexus/selectors";
import { money, pct, studentName } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/students")({ component: StudentsPage });

function StudentsPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const persona = useNexusSession((s) => s.persona);
  const dark = persona === "parent";
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  const students = snap.students;
  const [query, setQuery] = useState("");
  const filtered = students.filter((s) => {
    const qstr = query.trim().toLowerCase();
    if (!qstr) return true;
    const blob = [
      s.first_name,
      s.last_name,
      s.admission_number,
      classLabel(classById(snap, s.class_id)),
      s.status,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return blob.includes(qstr);
  });

  return (
    <div className={dark ? "text-foam" : ""}>
      <PageHeader
        kicker="People"
        title="Students"
        description="Search, open a profile, or edit student details. Click a name for full activity."
        actions={persona === "parent" ? null : (<><BulkImport schoolId={snap.school.id} onDone={() => void q.refetch()} /><EnrollDialog schoolId={snap.school.id} classes={snap.classes} /></>)}
      />
      <div className="mb-3">
        <Input
          placeholder="Search name, admission, class…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-md"
        />
      </div>
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
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
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
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                  <EditStudentButton student={s} schoolId={snap.school.id} classes={snap.classes} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    onClick={async () => {
                      if (!window.confirm(`Delete student ${studentName(s)}?`)) return;
                      try {
                        await deleteStudentRecord({
                          data: { schoolId: snap.school.id, studentId: s.id },
                        });
                        toast.success("Student deleted");
                        void invalidate();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Delete
                  </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No students match your search.
                </td>
              </tr>
            ) : null}
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


function BulkImport({ schoolId, onDone }: { schoolId: string; onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="outline"
      disabled={busy}
      onClick={() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".csv,text/csv";
        input.onchange = async () => {
          const file = input.files?.[0];
          if (!file) return;
          setBusy(true);
          try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(Boolean);
            if (lines.length < 2) throw new Error("CSV needs header + rows");
            const header = lines[0].toLowerCase();
            const cols = header.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
            const rows = lines.slice(1).map((line) => {
              const parts = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
              const obj: Record<string, string> = {};
              cols.forEach((c, i) => {
                obj[c] = parts[i] || "";
              });
              return obj;
            });
            if (cols.includes("admission_number") || cols.includes("first_name")) {
              const r = await bulkImportStudents({
                data: {
                  schoolId,
                  rows: rows.map((o) => ({
                    admission_number: o.admission_number || o.admission || "",
                    first_name: o.first_name || o.firstname || "",
                    last_name: o.last_name || o.lastname || "",
                    gender: o.gender,
                    class_name: o.class_name || o.class,
                    phone: o.phone,
                  })),
                },
              });
              toast.success(`Students: ${r.created} created, ${r.skipped} skipped`);
            } else if (cols.includes("phone") && (cols.includes("full_name") || cols.includes("name"))) {
              const r = await bulkImportParents({
                data: {
                  schoolId,
                  rows: rows.map((o) => ({
                    full_name: o.full_name || o.name || "",
                    phone: o.phone || "",
                    student_admission: o.student_admission || o.admission_number,
                    relationship: o.relationship,
                  })),
                },
              });
              toast.success(`Parents: ${r.created} created, ${r.linked} linked`);
            } else {
              throw new Error(
                "CSV headers: admission_number,first_name,last_name[,gender,class_name,phone] or full_name,phone[,student_admission]",
              );
            }
            onDone?.();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Import failed");
          } finally {
            setBusy(false);
          }
        };
        input.click();
      }}
    >
      {busy ? "Importing…" : "Import CSV"}
    </Button>
  );
}


function EditStudentButton({
  student,
  schoolId,
  classes,
}: {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_number: string;
    class_id: string | null;
    gender: string | null;
    date_of_birth: string | null;
    status: string;
  };
  schoolId: string;
  classes: { id: string; name: string; stream: string | null }[];
}) {
  const invalidate = useInvalidateSnapshot();
  const [open, setOpen] = useState(false);
  const [firstName, setFirst] = useState(student.first_name);
  const [lastName, setLast] = useState(student.last_name);
  const [admission, setAdmission] = useState(student.admission_number);
  const [classId, setClassId] = useState(student.class_id || "");
  const [status, setStatus] = useState(student.status);
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Edit
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit student</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>First name</Label>
              <Input value={firstName} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Last name</Label>
              <Input value={lastName} onChange={(e) => setLast(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Admission no.</Label>
              <Input value={admission} onChange={(e) => setAdmission(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Class</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
              >
                <option value="">Unplaced</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.stream ? ` ${c.stream}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="ACTIVE">ACTIVE</option>
                <option value="TRANSFERRED">TRANSFERRED</option>
                <option value="GRADUATED">GRADUATED</option>
                <option value="SUSPENDED">SUSPENDED</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await updateStudentRecord({
                    data: {
                      schoolId,
                      studentId: student.id,
                      firstName,
                      lastName,
                      admissionNumber: admission,
                      classId: classId || null,
                      status,
                    },
                  });
                  toast.success("Student updated");
                  setOpen(false);
                  void invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
