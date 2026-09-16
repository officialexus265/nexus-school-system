import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSnapshot } from "@/hooks/use-snapshot";
import { listAdmissions, reviewAdmission } from "@/lib/nexus/server";
import { formatDate } from "@/lib/utils";

export const Route = createFileRoute("/app/admissions")({ component: AdmissionsPage });

function AdmissionsPage() {
  const q = useSnapshot();
  const [apps, setApps] = useState<
    {
      id: string;
      applicant_name: string;
      guardian_name: string;
      guardian_phone: string;
      applying_class: string | null;
      status: string;
      created_at: string;
      previous_school: string | null;
    }[]
  >([]);

  async function refresh(schoolId: string) {
    setApps((await listAdmissions({ data: { schoolId } })).applications);
  }

  useEffect(() => {
    if (q.data?.school?.id) void refresh(q.data.school.id).catch(() => {});
  }, [q.data?.school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const schoolId = q.data.school.id;
  const slug = q.data.school.parent_app_slug || q.data.school.slug;
  const applyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/apply/${slug}`
      : `/apply/${slug}`;

  return (
    <div>
      <PageHeader
        kicker="Enrolment"
        title="Admissions"
        description="Online applications from the public form. Share the apply link with parents."
        actions={
          <Button
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(applyUrl);
              toast.success("Apply link copied");
            }}
          >
            Copy apply link
          </Button>
        }
      />
      <p className="mb-4 text-sm text-muted-foreground">
        Public form: <code className="rounded bg-secondary px-1.5 py-0.5">{applyUrl}</code>
      </p>
      <section className="overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Applicant</th>
              <th className="px-4 py-3">Guardian</th>
              <th className="px-4 py-3">Class</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{a.applicant_name}</td>
                <td className="px-4 py-3">
                  {a.guardian_name}
                  <span className="block text-xs text-muted-foreground">{a.guardian_phone}</span>
                </td>
                <td className="px-4 py-3">{a.applying_class || "—"}</td>
                <td className="px-4 py-3">
                  <StatusPill value={a.status} />
                </td>
                <td className="px-4 py-3">{formatDate(a.created_at)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {a.status === "SUBMITTED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await reviewAdmission({
                            data: {
                              schoolId,
                              applicationId: a.id,
                              status: "UNDER_REVIEW",
                            },
                          });
                          await refresh(schoolId);
                        }}
                      >
                        Review
                      </Button>
                    )}
                    {(a.status === "SUBMITTED" || a.status === "UNDER_REVIEW") && (
                      <>
                        <Button
                          size="sm"
                          onClick={async () => {
                            await reviewAdmission({
                              data: {
                                schoolId,
                                applicationId: a.id,
                                status: "ACCEPTED",
                              },
                            });
                            toast.success("Accepted");
                            await refresh(schoolId);
                          }}
                        >
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            await reviewAdmission({
                              data: {
                                schoolId,
                                applicationId: a.id,
                                status: "REJECTED",
                              },
                            });
                            await refresh(schoolId);
                          }}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {apps.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No applications yet. Share the apply link.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
