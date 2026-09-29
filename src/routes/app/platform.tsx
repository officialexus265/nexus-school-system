import { useEffect, useState } from "react";
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
  listSchoolAccountRequests,
  updateSchoolAccountRequest,
  deleteSchool,
  purgeExpiredDeletedSchools,
  getPlatformSettings,
  updatePlatformSettings,
  transitionSchoolStatus,
  wipeAllSchools,
  bootstrapPlatformOwner,
  resendSchoolInvite,
} from "@/lib/nexus/server";
import {
  BILLING_TIER_OPTIONS,
  SUBSCRIPTION_PRICES,
  type BillingPeriod,
  type BillingTier,
  formatMwk,
  priceFor,
  schoolTypeFromTier,
  tierLabel,
} from "@/lib/nexus/billing";

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
  const [area, setArea] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");
  const [contactPhoneDisplay, setContactPhoneDisplay] = useState("0980697476");
  const [contactPhoneE164, setContactPhoneE164] = useState("+265980697476");
  const [contactWhatsapp, setContactWhatsapp] = useState("265980697476");
  const [contactLabel, setContactLabel] = useState("system owner");
  const [supportEmail, setSupportEmail] = useState("");

  const [billingTier, setBillingTier] = useState<BillingTier>("all");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [activationFee, setActivationFee] = useState(
    String(priceFor("all", "monthly")),
  );
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);
  const [accountRequests, setAccountRequests] = useState<
    {
      id: string;
      school_name: string;
      contact_name: string;
      email: string;
      phone: string;
      city: string | null;
      sections: string;
      billing_tier: string;
      billing_period: string;
      quoted_amount: number;
      status: string;
      message: string | null;
      created_at: string;
    }[]
  >([]);

  async function loadRequests() {
    try {
      const r = await listSchoolAccountRequests({ data: {} });
      setAccountRequests(r.requests as typeof accountRequests);
    } catch {
      setAccountRequests([]);
    }
  }


  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;

  const schools = q.data.schools;
  const active = schools.filter((s) => s.status === "ACTIVE").length;
  const isPlatform = q.data.isPlatformOwner;

  useEffect(() => {
    if (isPlatform) {
      void loadRequests();
      void getPlatformSettings()
        .then((r) => {
          const s = r.settings;
          if (s.contact_phone_display) setContactPhoneDisplay(s.contact_phone_display);
          if (s.contact_phone_e164) setContactPhoneE164(s.contact_phone_e164);
          if (s.contact_whatsapp) setContactWhatsapp(s.contact_whatsapp);
          if (s.contact_label) setContactLabel(s.contact_label);
          if (s.support_email) setSupportEmail(s.support_email);
        })
        .catch(() => {});
    }
  }, [isPlatform]);

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
          area: area || undefined,
          activationFee: Number(activationFee) || priceFor(billingTier, billingPeriod),
          plan: "Standard",
          billingTier,
          billingPeriod,
          schoolType: schoolTypeFromTier(billingTier),
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
        <section className="mb-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Create school & invite owner</h2>
          <form onSubmit={handleCreate} className="mt-4 grid gap-3 sm:grid-cols-2">
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
              <Label htmlFor="area">Area / neighbourhood</Label>
              <Input
                id="area"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="e.g. Area 10, Ndirande"
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
              <Label>School package (sections)</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={billingTier}
                onChange={(e) => {
                  const tier = e.target.value as BillingTier;
                  setBillingTier(tier);
                  setActivationFee(String(priceFor(tier, billingPeriod)));
                }}
              >
                {BILLING_TIER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label} — {formatMwk(SUBSCRIPTION_PRICES[o.value].monthly)} / month
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Payment period</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={billingPeriod}
                onChange={(e) => {
                  const period = e.target.value as BillingPeriod;
                  setBillingPeriod(period);
                  setActivationFee(String(priceFor(billingTier, period)));
                }}
              >
                <option value="monthly">
                  Monthly — {formatMwk(priceFor(billingTier, "monthly"))}
                </option>
                <option value="term">
                  Per term — {formatMwk(priceFor(billingTier, "term"))}
                </option>
                <option value="annual">
                  Academic year — {formatMwk(priceFor(billingTier, "annual"))}
                </option>
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>All price options</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={`${billingTier}:${billingPeriod}`}
                onChange={(e) => {
                  const [tier, period] = e.target.value.split(":") as [
                    BillingTier,
                    BillingPeriod,
                  ];
                  setBillingTier(tier);
                  setBillingPeriod(period);
                  setActivationFee(String(priceFor(tier, period)));
                }}
              >
                {BILLING_TIER_OPTIONS.flatMap((o) =>
                  (["monthly", "term", "annual"] as BillingPeriod[]).map((period) => (
                    <option key={`${o.value}-${period}`} value={`${o.value}:${period}`}>
                      {o.label} ·{" "}
                      {period === "monthly"
                        ? "Monthly"
                        : period === "term"
                          ? "Per term"
                          : "Academic year"}{" "}
                      — {formatMwk(priceFor(o.value, period))}
                    </option>
                  )),
                )}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fee">Activation / first period fee (MWK)</Label>
              <Input
                id="fee"
                type="number"
                value={activationFee}
                onChange={(e) => setActivationFee(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={busy}>
                {busy ? "Creating…" : "Create & generate invite"}
              </Button>
            </div>
          </form>
          {lastInviteLink && (
            <p className="mt-3 break-all text-sm text-muted-foreground">
              Invite link:{" "}
              <a className="text-primary underline" href={lastInviteLink}>
                {lastInviteLink}
              </a>
            </p>
          )}
        </section>
      )}


      {isPlatform && (
        <section className="mb-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-xl">Login & contact settings</h2>
          <p className="text-sm text-muted-foreground">
            Shown on the public login page when someone wants a school account. Change these here —
            no code deploy needed for a new number.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Display phone (as shown)</Label>
              <Input
                value={contactPhoneDisplay}
                onChange={(e) => setContactPhoneDisplay(e.target.value)}
                placeholder="0980697476"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone for dial link (international)</Label>
              <Input
                value={contactPhoneE164}
                onChange={(e) => setContactPhoneE164(e.target.value)}
                placeholder="+265980697476"
              />
            </div>
            <div className="space-y-1.5">
              <Label>WhatsApp number (digits only, country code)</Label>
              <Input
                value={contactWhatsapp}
                onChange={(e) => setContactWhatsapp(e.target.value)}
                placeholder="265980697476"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Contact label</Label>
              <Input
                value={contactLabel}
                onChange={(e) => setContactLabel(e.target.value)}
                placeholder="system owner"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Support email (optional)</Label>
              <Input
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="support@example.com"
              />
            </div>
          </div>
          <Button
            type="button"
            className="mt-4"
            onClick={async () => {
              try {
                await updatePlatformSettings({
                  data: {
                    contactPhoneDisplay,
                    contactPhoneE164,
                    contactWhatsapp,
                    contactLabel,
                    supportEmail,
                  },
                });
                toast.success("Login contact settings saved");
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Save failed");
              }
            }}
          >
            Save contact settings
          </Button>
        </section>
      )}

      {isPlatform && (
        <section className="mb-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-xl">School account requests</h2>
              <p className="text-sm text-muted-foreground">
                Proposals submitted from the public login page.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void loadRequests()}>
              Refresh
            </Button>
          </div>
          {accountRequests.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No requests yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-2">School</th>
                    <th className="py-2 pr-2">Contact</th>
                    <th className="py-2 pr-2">Package</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accountRequests.map((r) => (
                    <tr key={r.id} className="border-t border-border align-top">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{r.school_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.city || "—"} · {new Date(r.created_at).toLocaleString()}
                        </div>
                        {r.message ? (
                          <div className="mt-1 text-xs text-muted-foreground">{r.message}</div>
                        ) : null}
                      </td>
                      <td className="py-2 pr-2">
                        <div>{r.contact_name}</div>
                        <div className="text-xs">{r.email}</div>
                        <div className="text-xs">{r.phone}</div>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="text-xs">{r.sections}</div>
                        <div className="text-xs">
                          {r.billing_tier} / {r.billing_period}
                        </div>
                        <div className="tabular-nums font-medium">
                          MWK {Number(r.quoted_amount).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-2 pr-2">{r.status}</td>
                      <td className="py-2">
                        <div className="flex flex-wrap gap-1">
                          {(["CONTACTED", "APPROVED", "REJECTED"] as const).map((st) => (
                            <Button
                              key={st}
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={r.status === st}
                              onClick={async () => {
                                try {
                                  await updateSchoolAccountRequest({
                                    data: { requestId: r.id, status: st },
                                  });
                                  toast.success(`Marked ${st}`);
                                  void loadRequests();
                                } catch (e) {
                                  toast.error(e instanceof Error ? e.message : "Failed");
                                }
                              }}
                            >
                              {st}
                            </Button>
                          ))}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setShowCreate(true);
                              setSchoolName(r.school_name);
                              setOwnerName(r.contact_name);
                              setOwnerEmail(r.email);
                              setCity(r.city || "");
                              toast.message("Create form filled — choose package & send invite");
                            }}
                          >
                            Create school
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

<section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-xl">Schools</h2>
            <div className="flex flex-wrap gap-2">
              <Input
                className="max-w-xs"
                placeholder="Search name, city, area, email…"
                value={schoolSearch}
                onChange={(e) => setSchoolSearch(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const r = await purgeExpiredDeletedSchools();
                    toast.success(`Purged ${r.purged} expired school(s)`);
                    await invalidate();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Purge failed");
                  }
                }}
              >
                Purge expired deletions
              </Button>
            </div>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Grouped by city → area. Soft-deleted schools stay 14 days for owner data export.
          </p>
          {(() => {
            const q = schoolSearch.trim().toLowerCase();
            const filtered = schools.filter((s) => {
              if (!q) return true;
              const blob = [
                s.name,
                s.city,
                (s as { area?: string }).area,
                s.owner_email,
                s.owner_name,
                s.slug,
                s.status,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
              return blob.includes(q);
            });
            const byCity = new Map<string, typeof filtered>();
            for (const s of filtered) {
              const cityKey = (s.city || "Unspecified city").trim();
              if (!byCity.has(cityKey)) byCity.set(cityKey, []);
              byCity.get(cityKey)!.push(s);
            }
            const cities = [...byCity.keys()].sort((a, b) => a.localeCompare(b));
            if (!filtered.length) {
              return (
                <p className="mt-4 text-sm text-muted-foreground">No schools match.</p>
              );
            }
            return cities.map((cityKey) => {
              const inCity = byCity.get(cityKey)!;
              const byArea = new Map<string, typeof inCity>();
              for (const s of inCity) {
                const areaKey = ((s as { area?: string }).area || "General").trim();
                if (!byArea.has(areaKey)) byArea.set(areaKey, []);
                byArea.get(areaKey)!.push(s);
              }
              return (
                <div key={cityKey} className="mt-6">
                  <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                    {cityKey}
                  </h3>
                  {[...byArea.keys()].sort().map((areaKey) => (
                    <div key={areaKey} className="mt-3">
                      <h4 className="text-xs font-medium uppercase text-muted-foreground">
                        {areaKey}
                      </h4>
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[640px] text-left text-sm">
                          <thead className="text-[11px] uppercase text-muted-foreground">
                            <tr>
                              <th className="py-2 pr-2">School</th>
                              <th className="py-2 pr-2">Owner</th>
                              <th className="py-2 pr-2">Status</th>
                              <th className="py-2 pr-2">Fee</th>
                              <th className="py-2">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {byArea.get(areaKey)!.map((s) => (
                              <tr key={s.id} className="border-t border-border">
                                <td className="py-2 pr-2">
                                  <div className="font-medium">{s.name}</div>
                                  <div className="text-xs text-muted-foreground">{s.slug}</div>
                                </td>
                                <td className="py-2 pr-2">
                                  <div>{s.owner_name}</div>
                                  <div className="text-xs">{s.owner_email}</div>
                                </td>
                                <td className="py-2 pr-2">
                                  <StatusPill value={s.status} />
                                  {s.status === "DELETED_PENDING_PURGE" &&
                                  (s as { purge_after?: string }).purge_after ? (
                                    <div className="text-[10px] text-muted-foreground">
                                      Purge after{" "}
                                      {new Date(
                                        (s as { purge_after?: string }).purge_after!,
                                      ).toLocaleDateString()}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="py-2 pr-2 tabular-nums">
                                  {money(s.activation_fee)}
                                </td>
                                <td className="py-2">
                                  <div className="flex flex-wrap gap-1">
                                    {s.status !== "ACTIVE" &&
                                      s.status !== "DELETED_PENDING_PURGE" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              await transitionSchoolStatus({
                                                data: {
                                                  schoolId: s.id,
                                                  toStatus: "ACTIVE",
                                                  reason: "Activation by platform owner",
                                                },
                                              });
                                              toast.success("Activated");
                                              await invalidate();
                                            } catch (e) {
                                              toast.error(
                                                e instanceof Error ? e.message : "Failed",
                                              );
                                            }
                                          }}
                                        >
                                          Activate
                                        </Button>
                                      )}
                                    {s.status !== "DELETED_PENDING_PURGE" && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="text-red-600"
                                        onClick={async () => {
                                          if (
                                            !window.confirm(
                                              `Soft-delete “${s.name}”? Owner has 14 days to export data, then permanent wipe.`,
                                            )
                                          )
                                            return;
                                          try {
                                            const r = await deleteSchool({
                                              data: { schoolId: s.id },
                                            });
                                            toast.success(
                                              r.message || "Scheduled for deletion",
                                            );
                                            await invalidate();
                                          } catch (e) {
                                            toast.error(
                                              e instanceof Error ? e.message : "Failed",
                                            );
                                          }
                                        }}
                                      >
                                        Delete
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            });
          })()}
        </section>

    </div>
  );
}
