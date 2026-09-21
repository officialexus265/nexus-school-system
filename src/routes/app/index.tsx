import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { PageHeader, StatCard } from "@/components/page-header";
import { ParentHome } from "@/components/parent/parent-home";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import {
  attendanceRate,
  classById,
  classLabel,
  currentTerm,
  defaultTeacher,
  schoolCollected,
  schoolOutstanding,
} from "@/lib/nexus/selectors";
import { money, pct } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";

export const Route = createFileRoute("/app/")({ component: AppHome });

function AppHome() {
  const persona = useNexusSession((s) => s.persona);
  const q = useSnapshot();
  if (q.isPending) return <DashSkeleton />;
  if (q.error || !q.data) {
    return (
      <div className="rounded-xl bg-card p-8 shadow-[var(--shadow-border)]">
        <h1 className="font-display text-2xl">Could not load the school desk.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {q.error instanceof Error ? q.error.message : "Unknown error"}
        </p>
        <Button className="mt-4" onClick={() => q.refetch()}>
          Retry
        </Button>
      </div>
    );
  }
  const snap = q.data;
  if (snap.isPlatformOwner) {
    return <Navigate to="/app/platform" />;
  }
  if (persona === "parent") return <ParentHome snap={snap} />;
  if (false && persona === "platform") {
    return (
      <div>
        <PageHeader
          kicker="Platform"
          title="NEXUS control"
          description="Activation, subscriptions and tenant health across the estate."
          actions={
            <Link to="/app/platform">
              <Button>Open platform</Button>
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-3">
          {snap.schools.map((s) => (
            <div key={s.id} className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-display text-xl">{s.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.city} · {s.subscription_plan}
                  </p>
                </div>
                <StatusPill value={s.status} />
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Activation {money(s.activation_fee)}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (persona === "teacher") return <TeacherHome snap={snap} />;
  if (persona === "bursar") return <BursarHome snap={snap} />;
  if (persona === "exam") return <ExamHome snap={snap} />;
  return <OwnerHome snap={snap} />;
}

function DashSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}

function OwnerHome({ snap }: { snap: NonNullable<ReturnType<typeof useSnapshot>["data"]> }) {
  const term = currentTerm(snap);
  const today = snap.attendance.filter((a) => a.date === "2026-09-15");
  const present = attendanceRate(today);
  const pending = snap.submissions.filter((s) => s.status !== "PUBLISHED" && s.status !== "LOCKED");
  return (
    <div>
      <PageHeader
        kicker={snap.school.name}
        title="Morning register"
        description={`${term?.name ?? "Term"} · 15 September 2026. ${snap.students.length} students on roll.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="On roll"
          value={String(snap.students.length)}
          hint={`${snap.staff.filter((s) => s.role === "teacher").length} teachers`}
        />
        <StatCard
          label="Today's attendance"
          value={pct(present)}
          hint={`${today.filter((a) => a.status === "PRESENT").length} present of ${today.length} marked`}
        />
        <StatCard
          label="Outstanding fees"
          value={money(schoolOutstanding(snap))}
          hint={`${money(schoolCollected(snap))} collected`}
        />
        <StatCard label="Result packets" value={String(pending.length)} hint="Awaiting review or publish" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl font-medium">Result pipeline</h2>
          <p className="text-sm text-muted-foreground">Form 2A · {term?.name}</p>
          <ul className="mt-4 space-y-3">
            {snap.submissions
              .filter((s) => s.term_id === term?.id)
              .map((s) => {
                const subj = snap.subjects.find((x) => x.id === s.subject_id);
                const cls = classById(snap, s.class_id);
                return (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{subj?.name}</p>
                      <p className="text-xs text-muted-foreground">{classLabel(cls)}</p>
                    </div>
                    <StatusPill value={s.status} />
                  </li>
                );
              })}
          </ul>
          <Link to="/app/results" className="mt-3 inline-block text-sm text-primary hover:underline">
            Open exam office
          </Link>
        </div>
        <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl font-medium">Ledger</h2>
          <ul className="mt-4 space-y-3">
            {snap.audit.slice(0, 5).map((a) => (
              <li key={a.id} className="border-b border-border pb-3 last:border-0">
                <p className="text-sm font-medium">{a.action.replaceAll("_", " ")}</p>
                <p className="text-xs text-muted-foreground">
                  {a.actor} · {a.detail}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function TeacherHome({ snap }: { snap: NonNullable<ReturnType<typeof useSnapshot>["data"]> }) {
  const teacher = defaultTeacher(snap);
  const mine = snap.assignments.filter((a) => a.staff_id === teacher?.id);
  const classIds = [...new Set(mine.map((a) => a.class_id))];
  return (
    <div>
      <PageHeader
        kicker="Teacher"
        title={teacher?.full_name ?? "Teacher"}
        description="Assigned classes and the Mathematics desk."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Classes" value={String(classIds.length)} />
        <StatCard label="Subjects" value={String(new Set(mine.map((a) => a.subject_id)).size)} />
        <StatCard
          label="Open assessments"
          value={String(snap.assessments.filter((a) => a.staff_id === teacher?.id).length)}
        />
      </div>
      <div className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Assignments</h2>
        <ul className="mt-3 divide-y divide-border">
          {mine.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-3 text-sm">
              <span>
                {classLabel(classById(snap, a.class_id))} ·{" "}
                {snap.subjects.find((s) => s.id === a.subject_id)?.name}
              </span>
              {a.is_class_teacher ? <StatusPill value="VERIFIED" /> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BursarHome({ snap }: { snap: NonNullable<ReturnType<typeof useSnapshot>["data"]> }) {
  const outstanding = schoolOutstanding(snap);
  const collected = schoolCollected(snap);
  const total = outstanding + collected;
  return (
    <div>
      <PageHeader
        kicker="Bursar"
        title="Term 2 collection"
        description="Verified payments only. A frontend success message is never enough."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Collected" value={money(collected)} />
        <StatCard label="Outstanding" value={money(outstanding)} />
        <StatCard label="Receipts" value={String(snap.payments.length)} />
      </div>
      <div className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl">Collection</h2>
          <span className="tabular-nums text-sm">{pct(total ? (collected / total) * 100 : 0)}</span>
        </div>
        <Progress className="mt-3" value={total ? (collected / total) * 100 : 0} />
        <Link to="/app/finance" className="mt-4 inline-block text-sm text-primary hover:underline">
          Open the ledger
        </Link>
      </div>
    </div>
  );
}

function ExamHome({ snap }: { snap: NonNullable<ReturnType<typeof useSnapshot>["data"]> }) {
  const term = currentTerm(snap);
  return (
    <div>
      <PageHeader
        kicker="Examination office"
        title="Packets in flight"
        description="Nothing reaches a parent until you approve and an authorised publisher confirms."
        actions={
          <Link to="/app/results">
            <Button>Review packets</Button>
          </Link>
        }
      />
      <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <ul className="divide-y divide-border">
          {snap.submissions
            .filter((s) => s.term_id === term?.id)
            .map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{snap.subjects.find((x) => x.id === s.subject_id)?.name}</p>
                  <p className="text-xs text-muted-foreground">{classLabel(classById(snap, s.class_id))}</p>
                </div>
                <StatusPill value={s.status} />
              </li>
            ))}
        </ul>
      </div>
    </div>
  );
}
