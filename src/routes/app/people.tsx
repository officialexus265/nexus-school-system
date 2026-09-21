import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  assignMemberRole,
  inviteStaffMember,
  listParentVerificationRequests,
  listSchoolRoles,
  registerSmsParent,
  reviewParentVerification,
} from "@/lib/nexus/server";
import { classById, classLabel } from "@/lib/nexus/selectors";
import { studentName } from "@/lib/utils";

export const Route = createFileRoute("/app/people")({ component: PeoplePage });

function PeoplePage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relationship, setRelationship] = useState("Guardian");
  const [smsOnly, setSmsOnly] = useState(true);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [verifications, setVerifications] = useState<
    {
      id: string;
      parent_phone: string;
      parent_name: string | null;
      student_number: string | null;
      student_name_guess: string | null;
      student_id: string | null;
      status: string;
    }[]
  >([]);

  async function loadVerifications(schoolId: string) {
    try {
      const res = await listParentVerificationRequests({ data: { schoolId } });
      setVerifications(res.requests);
    } catch {
      /* ignore if table missing */
    }
  }

  useEffect(() => {
    if (q.data?.school?.id) void loadVerifications(q.data.school.id);
  }, [q.data?.school?.id]);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;
  const snap = q.data;

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedStudents.length) {
      toast.error("Select at least one student");
      return;
    }
    setBusy(true);
    try {
      await registerSmsParent({
        data: {
          schoolId: snap.school.id,
          fullName,
          phone,
          studentIds: selectedStudents,
          relationship,
          smsOnly,
        },
      });
      toast.success(
        smsOnly
          ? "SMS-only parent registered. Welcome SMS queued."
          : "Parent registered. Welcome SMS queued.",
      );
      setFullName("");
      setPhone("");
      setSelectedStudents([]);
      setShowForm(false);
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function toggleStudent(id: string) {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Directory"
        title="Staff & parents"
        description="Teaching assignments are separate from organisational roles. Register SMS-only parents for phones without smartphones."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Close form" : "Register parent"}
          </Button>
        }
      />

      {showForm && (
        <section className="mb-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Register parent / guardian</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            SMS-only parents receive fee reminders, results notices and announcements by text.
            They do not need the app.
          </p>
          <form onSubmit={handleRegister} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Full name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                placeholder="e.g. Parent full name"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone *</Label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="e.g. 0991 234 567"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Relationship</Label>
              <Input
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="Mother / Father / Guardian"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={smsOnly}
                  onChange={(e) => setSmsOnly(e.target.checked)}
                  className="size-4 accent-primary"
                />
                SMS-only (no smartphone app)
              </label>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Link to students *</Label>
              <div className="max-h-48 overflow-y-auto rounded-lg border border-border p-2">
                <div className="grid gap-1 sm:grid-cols-2">
                  {snap.students.map((st) => {
                    const cls = classById(snap, st.class_id);
                    return (
                      <label
                        key={st.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-secondary"
                      >
                        <input
                          type="checkbox"
                          checked={selectedStudents.includes(st.id)}
                          onChange={() => toggleStudent(st.id)}
                          className="size-4 accent-primary"
                        />
                        <span>
                          {studentName(st)}
                          <span className="text-muted-foreground">
                            {" "}
                            · {classLabel(cls)} · {st.admission_number}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving…" : "Register & send welcome SMS"}
              </Button>
            </div>
          </form>
        </section>
      )}

      <Tabs defaultValue="staff">
        <TabsList>
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="parents">Parents</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <StaffInvite schoolId={snap.school.id} onDone={() => void invalidate()} />
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
                            `${classLabel(classById(snap, a.class_id))} ${
                              snap.subjects.find((sub) => sub.id === a.subject_id)?.code ?? ""
                            }`,
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
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Parent</th>
                  <th className="px-4 py-3 font-medium">Phone</th>
                  <th className="px-4 py-3 font-medium">Children</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Link</th>
                </tr>
              </thead>
              <tbody>
                {snap.parents.map((p) => {
                  const kids = snap.parentLinks
                    .filter((l) => l.parent_id === p.id)
                    .map((l) => snap.students.find((s) => s.id === l.student_id))
                    .filter(Boolean);
                  const smsOnlyFlag = (p as { sms_only?: boolean }).sms_only;
                  return (
                    <tr key={p.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">{p.full_name}</td>
                      <td className="px-4 py-3 tabular-nums text-muted-foreground">{p.phone}</td>
                      <td className="px-4 py-3">
                        {kids.map((k) => (k ? studentName(k) : "")).join(", ")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">
                          {smsOnlyFlag ? "SMS only" : "App / SMS"}
                        </span>
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

      {verifications.filter((v) => v.status === "PENDING").length > 0 && (
        <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Parent link requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Parents requested to link a child from the parent app. Approve to create the relationship.
          </p>
          <ul className="mt-3 space-y-2">
            {verifications
              .filter((v) => v.status === "PENDING")
              .map((v) => (
                <li
                  key={v.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span>
                    {v.parent_name || "Parent"} · {v.parent_phone}
                    {v.student_number ? ` · student #${v.student_number}` : ""}
                    {v.student_name_guess ? ` · ${v.student_name_guess}` : ""}
                  </span>
                  <span className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await reviewParentVerification({
                            data: {
                              schoolId: snap.school.id,
                              requestId: v.id,
                              action: "APPROVE",
                              studentId: v.student_id || undefined,
                            },
                          });
                          toast.success("Approved");
                          await loadVerifications(snap.school.id);
                          await invalidate();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        try {
                          await reviewParentVerification({
                            data: {
                              schoolId: snap.school.id,
                              requestId: v.id,
                              action: "REJECT",
                            },
                          });
                          toast.success("Rejected");
                          await loadVerifications(snap.school.id);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                    >
                      Reject
                    </Button>
                  </span>
                </li>
              ))}
          </ul>
        </section>
      )}
      </Tabs>
    </div>
  );
}


function StaffInvite({ schoolId, onDone }: { schoolId: string; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [roleName, setRoleName] = useState("teacher");
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);

  useEffect(() => {
    void listSchoolRoles({ data: { schoolId } })
      .then((r) => setRoles(r.roles.map((x) => ({ id: x.id, name: x.name }))))
      .catch(() => {});
  }, [schoolId]);

  return (
    <section className="mb-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg">Invite staff</h2>
        <Button size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Invite by email"}
        </Button>
      </div>
      {open && (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setLink(null);
            try {
              const r = await inviteStaffMember({
                data: {
                  schoolId,
                  fullName,
                  email,
                  roleName: roleId ? roles.find((x) => x.id === roleId)?.name || roleName : roleName,
                  roleId: roleId || undefined,
                },
              });
              setLink(r.inviteLink);
              toast.success(r.emailSent ? "Invite email sent" : "Invite created — copy link");
              setFullName("");
              setEmail("");
              onDone();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="space-y-1">
            <Label>Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Role name</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
            >
              <option value="teacher">Teacher</option>
              <option value="bursar">Bursar</option>
              <option value="exam">Exam officer</option>
              <option value="head">Head teacher</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label>Custom role (optional)</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
            >
              <option value="">— none —</option>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" disabled={busy} className="sm:col-span-2">
            {busy ? "Sending…" : "Send staff invite"}
          </Button>
          {link && (
            <p className="sm:col-span-2 break-all text-xs text-muted-foreground">
              Invite link: {link}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
