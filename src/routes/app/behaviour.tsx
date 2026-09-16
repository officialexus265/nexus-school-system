import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { addBehaviour } from "@/lib/nexus/server";
import { defaultParent, parentChildren } from "@/lib/nexus/selectors";
import { formatDate, studentName } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/behaviour")({ component: BehaviourPage });

function BehaviourPage() {
  const q = useSnapshot();
  const persona = useNexusSession((s) => s.persona);
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;

  if (persona === "parent") {
    const parent = defaultParent(snap);
    const ids = new Set((parent ? parentChildren(snap, parent.id) : []).map((c) => c.id));
    const rows = snap.behaviour.filter((b) => ids.has(b.student_id));
    return (
      <div>
        <h1 className="font-display text-3xl text-foam">Behaviour</h1>
        <p className="mt-1 text-sm text-mist">The school chooses which incidents parents can see.</p>
        <ul className="mt-6 space-y-3">
          {rows.map((b) => (
            <li key={b.id} className="rounded-xl border border-foam/10 bg-ink-2 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foam">{b.category}</p>
                <StatusPill value={b.kind} />
              </div>
              <p className="mt-1 text-sm text-mist">{b.description}</p>
              <p className="mt-2 text-xs text-mist">
                {(() => {
                  const st = snap.students.find((s) => s.id === b.student_id);
                  return st ? studentName(st) : "Student";
                })()}{" "}
                · {formatDate(b.date)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Pastoral"
        title="Behaviour"
        description="Positive and negative records, with points and an auditable case trail."
        actions={<RecordIncident students={snap.students} />}
      />
      <div className="space-y-3">
        {snap.behaviour.map((b) => {
          const s = snap.students.find((x) => x.id === b.student_id);
          return (
            <article key={b.id} className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{s ? studentName(s) : "Student"}</p>
                  <p className="text-sm text-muted-foreground">
                    {b.category} · {formatDate(b.date)} · {b.recorded_by}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill value={b.kind} />
                  <span className="tabular-nums text-sm">{b.points > 0 ? `+${b.points}` : b.points}</span>
                </div>
              </div>
              <p className="mt-3 text-sm">{b.description}</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function RecordIncident({
  students,
}: {
  students: { id: string; first_name: string; last_name: string }[];
}) {
  const invalidate = useInvalidateSnapshot();
  const [open, setOpen] = useState(false);
  const [studentId, setStudent] = useState(students[0]?.id ?? "");
  const [kind, setKind] = useState<"POSITIVE" | "NEGATIVE">("NEGATIVE");
  const [category, setCategory] = useState("Punctuality");
  const [description, setDesc] = useState("");
  const [points, setPoints] = useState("-2");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Record incident</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record incident</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Student</Label>
            <Select value={studentId} onValueChange={setStudent}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {students.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.first_name} {s.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kind</Label>
              <Select value={kind} onValueChange={(v) => setKind(v as "POSITIVE" | "NEGATIVE")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="POSITIVE">Positive</SelectItem>
                  <SelectItem value="NEGATIVE">Negative</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Points</Label>
              <Input value={points} onChange={(e) => setPoints(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDesc(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={busy || !description.trim()}
            onClick={async () => {
              setBusy(true);
              try {
                await addBehaviour({
                  data: {
                    studentId,
                    category,
                    kind,
                    description,
                    points: Number(points) || 0,
                  },
                });
                toast.success("Incident recorded");
                setOpen(false);
                setDesc("");
                await invalidate();
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
  );
}
