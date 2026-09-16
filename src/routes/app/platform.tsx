import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  createSchoolInvite,
  deleteSchool,
  transitionSchoolStatus,
  wipeAllSchools,
  bootstrapPlatformOwner,
} from "@/lib/nexus/server";
import { money } from "@/lib/utils";

export const Route = createFileRoute("/app/platform")({ component: PlatformPage });

function PlatformPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const [showCreate, setShowCreate] = useState(false);
  const [schoolName, setSchoolName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [city, setCity] = useState("");
  const [activationFee, setActivationFee] = useState("150000");
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;

  const schools = q.data.schools;
  const active = schools.filter((s) => s.status === "ACTIVE").length;
  const isPlatform = q.data.isPlatformOwner;


  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setLastInviteLink(null);
    try {
      const result = await createSchoolInvite({
        data: {
          schoolName,
          ownerName,
          ownerEmail,
          city: city || undefined,
          activationFee: Number(activationFee) || 150000,
          plan: "Standard",
        },
      });
      toast.success(`School “${result.schoolName}” created. Invite ready.`);
      setLastInviteLink(result.inviteLink);
      setSchoolName("");
      setOwnerName("");
      setOwnerEmail("");
      setCity("");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="NEXUS"
        title="Platform owner"
        description="Open school accounts, invite owners, activate, suspend, or permanently delete schools."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (
                  !window.confirm(
                    "Delete ALL schools and related data? This cannot be undone.",
                  )
                )
                  return;
                try {
                  const r = await wipeAllSchools();
                  toast.success(`Removed ${r.deleted} school(s)`);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Wipe all schools
            </Button>
            <Button onClick={() => setShowCreate((v) => !v)}>
              {showCreate ? "Close form" : "Create school"}
            </Button>
          </div>
        }
      />

      {!isPlatform && (
        <section className="mb-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium">This account is not platform owner yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you just registered, click below to claim super admin (only works when no platform
            owner exists).
          </p>
          <Button
            className="mt-3"
            onClick={async () => {
              try {
                await bootstrapPlatformOwner({ data: {} });
                toast.success("You are now the platform super admin");
                await invalidate();
                window.location.href = "/app/platform";
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Failed");
              }
            }}
          >
            Claim super admin
          </Button>
        </section>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Schools" value={String(schools.length)} />
        <StatCard label="Active" value={String(active)} />
        <StatCard
          label="Activation book"
          value={money(schools.reduce((a, s) => a + Number(s.activation_fee ?? 0), 0))}
        />
      </div>

      {showCreate && (
        <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Create school & invite owner</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            An invite link will be generated. In production an email is sent automatically.
            For now, copy the link and send it to the school owner (WhatsApp / email).
          </p>
          <form onSubmit={handleCreate} className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="schoolName">School name *</Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                placeholder="e.g. Lakeview Secondary"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Lilongwe"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerName">Owner full name *</Label>
              <Input
                id="ownerName"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                required
                placeholder="e.g. Chisomo Banda"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ownerEmail">Owner email *</Label>
              <Input
                id="ownerEmail"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                required
                placeholder="owner@school.ac.mw"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee">Activation fee (MWK)</Label>
              <Input
                id="fee"
                type="number"
                value={activationFee}
                onChange={(e) => setActivationFee(e.target.value)}
                min={0}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                {busy ? "Creating…" : "Create & generate invite"}
              </Button>
            </div>
          </form>

          {lastInviteLink && (
            <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                Invite link ready — copy and send to the school owner
              </p>
              <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
                <code className="flex-1 break-all rounded bg-muted px-3 py-2 text-xs">
                  {lastInviteLink}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(lastInviteLink);
                    toast.success("Link copied");
                  }}
                >
                  Copy link
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                The owner opens this link, sets a password, and lands in their school workspace.
                Link expires in 7 days.
              </p>
            </div>
          )}
        </section>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">School</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">City</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Fee</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.registration_number}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{s.owner_name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">{s.owner_email ?? ""}</p>
                </td>
                <td className="px-4 py-3">{s.city}</td>
                <td className="px-4 py-3">{s.subscription_plan}</td>
                <td className="px-4 py-3 tabular-nums">{money(s.activation_fee)}</td>
                <td className="px-4 py-3">
                  <StatusPill value={s.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {s.status !== "ACTIVE" ? (
                    <Button
                      size="sm"
                      onClick={async () => {
                        try {
                          await transitionSchoolStatus({
                            data: { schoolId: s.id, toStatus: "ACTIVE", reason: "Activation by platform owner" },
                          });
                          toast.success(`${s.name} is now active`);
                          await invalidate();
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "Failed");
                        }
                      }}
                    >
                      Activate
                    </Button>
                  ) : (
                    <div className="flex justify-end gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await transitionSchoolStatus({
                              data: {
                                schoolId: s.id,
                                toStatus: "GRACE_PERIOD",
                                reason: "Grace period started",
                              },
                            });
                            toast.success("Grace period started");
                            await invalidate();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Grace
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await transitionSchoolStatus({
                              data: {
                                schoolId: s.id,
                                toStatus: "SUSPENDED",
                                reason: "Suspended by platform",
                              },
                            });
                            toast.success("School suspended");
                            await invalidate();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Suspend
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Permanently delete “${s.name}” and all its data?`,
                            )
                          )
                            return;
                          try {
                            await deleteSchool({ data: { schoolId: s.id } });
                            toast.success("School deleted");
                            await invalidate();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Audit</h2>
        <ul className="mt-3 space-y-2">
          {q.data.audit.slice(0, 8).map((a) => (
            <li key={a.id} className="text-sm">
              <span className="font-medium">{a.action.replaceAll("_", " ")}</span>
              <span className="text-muted-foreground">
                {" "}
                · {a.actor} · {a.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
