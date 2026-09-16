import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { classById, classLabel } from "@/lib/nexus/selectors";
import { studentName } from "@/lib/utils";

export const Route = createFileRoute("/app/people")({ component: PeoplePage });

function PeoplePage() {
  const q = useSnapshot();
  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;
  return (
    <div>
      <PageHeader
        kicker="Directory"
        title="Staff & parents"
        description="Teaching assignments are separate from organisational roles."
      />
      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {snap.staff.map((s) => {
              const taught = snap.assignments.filter((a) => a.staff_id === s.id);
              return (
                <div key={s.id} className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
                  <div className="flex items-start gap-3">
                    <Avatar name={s.full_name} tone="teal" />
                    <div className="min-w-0">
                      <p className="font-medium">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground">{s.title}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <StatusPill value={s.role.toUpperCase()} />
                  </div>
                  {taught.length ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {taught
                        .map(
                          (a) =>
                            `${classLabel(classById(snap, a.class_id))} ${snap.subjects.find((x) => x.id === a.subject_id)?.code ?? ""}`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </TabsContent>
        <TabsContent value="parents">
          <div className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Parent</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Children</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {snap.parents.map((p) => {
                  const kids = snap.parentLinks
                    .filter((l) => l.parent_id === p.id)
                    .map((l) => snap.students.find((s) => s.id === l.student_id))
                    .filter(Boolean);
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{p.full_name}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.phone}</td>
                      <td className="px-4 py-3">
                        {kids.map((k) => (k ? studentName(k) : "")).join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill value={p.verification_status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
