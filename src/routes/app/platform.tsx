import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  bootstrapPlatformOwner,
  createSchoolInvite,
  deleteSchool,
  getPlatformSettings,
  listSchoolAccountRequests,
  purgeExpiredDeletedSchools,
  resendSchoolInvite,
  transitionSchoolStatus,
  updatePlatformSettings,
  updateSchoolAccountRequest,
  wipeAllSchools,
  updateSchoolByPlatform,
  grantSchoolAccessPeriod,
  applySchoolDiscount,
  listPlatformPromotions,
  createPlatformPromotion,
  runLuckySchoolDraw,
  saveDiscountSettings,
} from "@/lib/nexus/server";
import {
  BILLING_TIER_OPTIONS,
  SUBSCRIPTION_PRICES,
  type BillingPeriod,
  type BillingTier,
  formatMwk,
  priceFor,
  schoolTypeFromTier,
} from "@/lib/nexus/billing";
import { money } from "@/lib/utils";

export const Route = createFileRoute("/app/platform")({ component: PlatformPage });

type AccountRequest = {
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
};

function PlatformPage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();

  const [platformTab, setPlatformTab] = useState("schools");
  const [showCreate, setShowCreate] = useState(false);
  const [schoolStatusTab, setSchoolStatusTab] = useState<
    "all" | "active" | "pending" | "paused" | "balance" | "deleted"
  >("all");
  const [editSchool, setEditSchool] = useState<{
    id: string;
    name: string;
    city: string;
    area: string;
    ownerName: string;
    ownerEmail: string;
  } | null>(null);
  const [grantDialog, setGrantDialog] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [grantUnit, setGrantUnit] = useState<"days" | "months" | "terms" | "years">("months");
  const [grantAmount, setGrantAmount] = useState("1");
  const [grantReason, setGrantReason] = useState("Partner / pilot access");
  const [grantStack, setGrantStack] = useState(false);
  const [grantBusy, setGrantBusy] = useState(false);

  const [pauseDialog, setPauseDialog] = useState<{ id: string; name: string } | null>(null);
  const [pauseReason, setPauseReason] = useState("Subscription fee not paid");
  const [pauseBusy, setPauseBusy] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [wipeDialogOpen, setWipeDialogOpen] = useState(false);
  const [wipeConfirmText, setWipeConfirmText] = useState("");
  const [wipeBusy, setWipeBusy] = useState(false);

  const [purgeDialogOpen, setPurgeDialogOpen] = useState(false);
  const [purgeBusy, setPurgeBusy] = useState(false);

  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);

  const [schoolName, setSchoolName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [schoolSearch, setSchoolSearch] = useState("");

  const [billingTier, setBillingTier] = useState<BillingTier>("all");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [activationFee, setActivationFee] = useState(String(priceFor("all", "monthly")));
  const [busy, setBusy] = useState(false);
  const [lastInviteLink, setLastInviteLink] = useState<string | null>(null);

  const [contactPhoneDisplay, setContactPhoneDisplay] = useState("0980697476");
  const [googleOauthTestUsersUrl,
                      platformAlertEmail, setGoogleOauthTestUsersUrl] = useState(
    "https://console.cloud.google.com/auth/audience?project=nsms-510209",
  );
  const [contactPhoneE164, setContactPhoneE164] = useState("+265980697476");
  const [contactWhatsapp, setContactWhatsapp] = useState("265980697476");
  const [contactLabel, setContactLabel] = useState("system owner");
  const [supportEmail, setSupportEmail] = useState("");
  const [platformAlertEmail, setPlatformAlertEmail] = useState("");
  const [luckySharePct, setLuckySharePct] = useState("20");
  const [luckyDiscountPct, setLuckyDiscountPct] = useState("15");
  const [firstSubDiscPct, setFirstSubDiscPct] = useState("0");
  const [activationDiscPct, setActivationDiscPct] = useState("0");
  const [promoKind, setPromoKind] = useState<"DISCOUNT" | "SIGNUP">("SIGNUP");
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [promoOg, setPromoOg] = useState("");
  const [promoDisc, setPromoDisc] = useState("10");
  const [promoShareUrl, setPromoShareUrl] = useState<string | null>(null);

  const [accountRequests, setAccountRequests] = useState<AccountRequest[]>([]);

  const isPlatform = Boolean(q.data?.isPlatformOwner);

  async function loadRequests() {
    try {
      const r = await listSchoolAccountRequests({ data: {} });
      setAccountRequests((r.requests || []) as AccountRequest[]);
    } catch {
      setAccountRequests([]);
    }
  }

  useEffect(() => {
    if (!isPlatform) return;
    void loadRequests();
    void getPlatformSettings()
      .then((r) => {
        const s = r.settings || {};
        if (s.contact_phone_display) setContactPhoneDisplay(s.contact_phone_display);
        if (s.contact_phone_e164) setContactPhoneE164(s.contact_phone_e164);
        if (s.contact_whatsapp) setContactWhatsapp(s.contact_whatsapp);
        if (s.contact_label) setContactLabel(s.contact_label);
        if (s.support_email) setSupportEmail(s.support_email);
        if (s.platform_alert_email) setPlatformAlertEmail(s.platform_alert_email);
        if (s.google_oauth_test_users_url)
          setGoogleOauthTestUsersUrl(s.google_oauth_test_users_url);
      })
      .catch(() => {});
  }, [isPlatform]);

  const schools = q.data?.schools || [];
  const active = schools.filter((s) => s.status === "ACTIVE").length;

  const openRequests = useMemo(
    () => accountRequests.filter((r) => r.status !== "CONVERTED" && r.status !== "REJECTED"),
    [accountRequests],
  );

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
      if (pendingRequestId) {
        try {
          await updateSchoolAccountRequest({
            data: { requestId: pendingRequestId, status: "CONVERTED" },
          });
        } catch {
          /* non-fatal */
        }
        setPendingRequestId(null);
        void loadRequests();
      }
      setSchoolName("");
      setOwnerName("");
      setOwnerEmail("");
      setCity("");
      setArea("");
      setShowCreate(false);
      setPlatformTab("schools");
      await invalidate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create school");
    } finally {
      setBusy(false);
    }
  }

  if (q.isPending) return <Skeleton className="h-64" />;
  if (!q.data) return null;

  const filteredSchools = schools.filter((s) => {
    const st = (s.status || "").toUpperCase();
    if (schoolStatusTab === "active" && !(st === "ACTIVE" || st === "TRIAL")) return false;
    if (
      schoolStatusTab === "pending" &&
      !(st === "PENDING_PAYMENT" || st === "PENDING" || st === "GRACE_PERIOD")
    )
      return false;
    if (
      schoolStatusTab === "paused" &&
      !(st === "PAUSED" || st === "SUSPENDED" || st === "CANCELLED")
    )
      return false;
    if (schoolStatusTab === "deleted" && st !== "DELETED_PENDING_PURGE") return false;
    if (
      schoolStatusTab === "balance" &&
      !(st === "PENDING_PAYMENT" || st === "GRACE_PERIOD")
    )
      return false;

    const term = schoolSearch.trim().toLowerCase();
    if (!term) return true;
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
    return blob.includes(term);
  });

  const byCity = new Map<string, typeof filteredSchools>();
  for (const s of filteredSchools) {
    const cityKey = (s.city || "Unspecified city").trim();
    if (!byCity.has(cityKey)) byCity.set(cityKey, []);
    byCity.get(cityKey)!.push(s);
  }
  const cityKeys = [...byCity.keys()].sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="NEXUS"
        title="Platform owner"
        description="Manage schools, account requests, and login contact details."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => {
              setWipeConfirmText("");
              setWipeDialogOpen(true);
            }}>
              Wipe all schools
            </Button>
            <Button
              onClick={() => {
                setShowCreate(true);
                setPlatformTab("settings");
              }}
            >
              Create school
            </Button>
          </div>
        }
      />

      {!isPlatform && (
        <section className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium">This account is not platform owner yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            If you just registered, claim super admin (only when no platform owner exists).
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
          label="Open requests"
          value={String(openRequests.length)}
        />
      </div>

      <Tabs value={platformTab} onValueChange={setPlatformTab} className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap gap-1">
          <TabsTrigger value="schools">Schools</TabsTrigger>
          <TabsTrigger value="requests">
            Requests
            {openRequests.length > 0 ? ` (${openRequests.length})` : ""}
          </TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* —— Schools —— */}
        <TabsContent value="schools" className="space-y-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-display text-xl">Schools</h2>
                <p className="text-xs text-muted-foreground">
                  Grouped by city → area. Soft-deleted schools stay 14 days for owner export.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:max-w-xl">
                <Input
                  className="w-full"
                  placeholder="Search name, city, area, email…"
                  value={schoolSearch}
                  onChange={(e) => setSchoolSearch(e.target.value)}
                />
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm sm:min-w-[14rem]"
                    value={schoolStatusTab}
                    onChange={(e) =>
                      setSchoolStatusTab(
                        e.target.value as
                          | "all"
                          | "active"
                          | "pending"
                          | "balance"
                          | "paused"
                          | "deleted",
                      )
                    }
                    aria-label="Filter schools by status"
                  >
                    <option value="all">All schools</option>
                    <option value="active">Active</option>
                    <option value="pending">Pending / unpaid</option>
                    <option value="balance">Balances due</option>
                    <option value="paused">Paused / suspended</option>
                    <option value="deleted">Deleted (14-day grace)</option>
                  </select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    title="Permanently remove schools whose 14-day export grace after deletion has ended. Soft-deleted schools that are still within 14 days are not touched."
                    onClick={() => setPurgeDialogOpen(true)}
                  >
                    Purge expired deletions
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Purge only removes soft-deleted schools after the 14-day download window ends —
                  not active schools.
                </p>
              </div>
            </div>

            {filteredSchools.length === 0 ? (
              <p className="mt-6 text-sm text-muted-foreground">No schools match.</p>
            ) : (
              cityKeys.map((cityKey) => {
                const inCity = byCity.get(cityKey)!;
                const byArea = new Map<string, typeof inCity>();
                for (const s of inCity) {
                  const areaKey = ((s as { area?: string }).area || "General").trim();
                  if (!byArea.has(areaKey)) byArea.set(areaKey, []);
                  byArea.get(areaKey)!.push(s);
                }
                return (
                  <div key={cityKey} className="mt-8">
                    <h3 className="text-sm font-semibold tracking-wide text-muted-foreground">
                      {cityKey}
                    </h3>
                    {[...byArea.keys()].sort().map((areaKey) => (
                      <div key={areaKey} className="mt-3">
                        <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {areaKey}
                        </h4>
                        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
                          <table className="w-full min-w-[720px] text-left text-sm">
                            <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                              <tr>
                                <th className="px-3 py-2.5 font-medium">School</th>
                                <th className="px-3 py-2.5 font-medium">Owner</th>
                                <th className="px-3 py-2.5 font-medium">Status</th>
                                <th className="px-3 py-2.5 font-medium">Fee</th>
                                <th className="px-3 py-2.5 font-medium">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {byArea.get(areaKey)!.map((s) => (
                                <tr key={s.id} className="border-t border-border">
                                  <td className="px-3 py-2.5 align-top">
                                    <div className="font-medium">{s.name}</div>
                                    <div className="text-xs text-muted-foreground">{s.slug}</div>
                                  </td>
                                  <td className="px-3 py-2.5 align-top">
                                    <div>{s.owner_name}</div>
                                    <div className="text-xs text-muted-foreground">
                                      {s.owner_email}
                                    </div>
                                  </td>
                                  <td className="px-3 py-2.5 align-top">
                                    <StatusPill value={s.status} />
                                    {s.status === "DELETED_PENDING_PURGE" &&
                                    (s as { purge_after?: string }).purge_after ? (
                                      <div className="mt-1 text-[10px] text-muted-foreground">
                                        Purge after{" "}
                                        {new Date(
                                          (s as { purge_after?: string }).purge_after!,
                                        ).toLocaleDateString()}
                                      </div>
                                    ) : null}
                                  </td>
                                  <td className="px-3 py-2.5 align-top tabular-nums">
                                    {money(s.activation_fee)}
                                  </td>
                                  <td className="px-3 py-2.5 align-top">
                                    <div className="flex flex-wrap gap-1.5">
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
                                      {(s.status === "PENDING_PAYMENT" ||
                                        s.status === "PENDING") && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              const r = await resendSchoolInvite({
                                                data: { schoolId: s.id },
                                              });
                                              if (r.emailSent) {
                                                toast.success("Invite email resent");
                                              } else {
                                                toast.message(
                                                  "Email may have failed — use the copied link",
                                                );
                                              }
                                              if (r.inviteLink) {
                                                try {
                                                  await navigator.clipboard.writeText(
                                                    r.inviteLink,
                                                  );
                                                  toast.success("Invite link copied");
                                                } catch {
                                                  window.prompt(
                                                    "Copy invite link:",
                                                    r.inviteLink,
                                                  );
                                                }
                                              }
                                            } catch (e) {
                                              toast.error(
                                                e instanceof Error ? e.message : "Resend failed",
                                              );
                                            }
                                          }}
                                        >
                                          Resend invite
                                        </Button>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          setEditSchool({
                                            id: s.id,
                                            name: s.name,
                                            city: s.city || "",
                                            area: (s as { area?: string }).area || "",
                                            ownerName: s.owner_name || "",
                                            ownerEmail: s.owner_email || "",
                                          });
                                        }}
                                      >
                                        Edit
                                      </Button>

                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={async () => {
                                          const pct = window.prompt(
                                            "Activation discount % for this school (0-100)",
                                            "10",
                                          );
                                          if (pct == null) return;
                                          try {
                                            await applySchoolDiscount({
                                              data: {
                                                schoolId: s.id,
                                                activationDiscountPct: Number(pct) || 0,
                                              },
                                            });
                                            toast.success("Discount applied");
                                            await invalidate();
                                          } catch (e) {
                                            toast.error(
                                              e instanceof Error ? e.message : "Failed",
                                            );
                                          }
                                        }}
                                      >
                                        Set discount
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-emerald-600/40 text-emerald-800"
                                        onClick={() => {
                                          setGrantUnit("months");
                                          setGrantAmount("1");
                                          setGrantReason("Partner / pilot access");
                                          setGrantStack(false);
                                          setGrantDialog({ id: s.id, name: s.name });
                                        }}
                                      >
                                        Grant access
                                      </Button>
                                      {s.status !== "PAUSED" && s.status !== "SUSPENDED" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-amber-800"
                                          onClick={() => {
                                            setPauseReason("Subscription fee not paid");
                                            setPauseDialog({ id: s.id, name: s.name });
                                          }}
                                        >
                                          Pause
                                        </Button>
                                      )}
                                      {(s.status === "PAUSED" || s.status === "SUSPENDED") && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={async () => {
                                            try {
                                              await transitionSchoolStatus({
                                                data: {
                                                  schoolId: s.id,
                                                  toStatus: "ACTIVE" as never,
                                                  reason: "",
                                                },
                                              });
                                              toast.success("School reactivated");
                                              await invalidate();
                                            } catch (e) {
                                              toast.error(
                                                e instanceof Error ? e.message : "Failed",
                                              );
                                            }
                                          }}
                                        >
                                          Resume
                                        </Button>
                                      )}
                                      {s.status !== "DELETED_PENDING_PURGE" && (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          className="text-red-600"
                                          onClick={() =>
                                            setDeleteDialog({ id: s.id, name: s.name })
                                          }
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
              })
            )}
          </section>
        </TabsContent>

        {/* —— Requests —— */}
        <TabsContent value="requests" className="space-y-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl">School account requests</h2>
                <p className="text-sm text-muted-foreground">
                  From the public login page. Converted requests leave this list.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => void loadRequests()}>
                Refresh
              </Button>
            </div>

            {openRequests.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No open requests.</p>
            ) : (
              <div className="mt-4 overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2.5 font-medium">School</th>
                      <th className="px-3 py-2.5 font-medium">Contact</th>
                      <th className="px-3 py-2.5 font-medium">Package</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="px-3 py-2.5 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openRequests.map((r) => (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="px-3 py-2.5">
                          <div className="font-medium">{r.school_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.city || "—"} · {new Date(r.created_at).toLocaleString()}
                          </div>
                          {r.message ? (
                            <div className="mt-1 text-xs text-muted-foreground">{r.message}</div>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5">
                          <div>{r.contact_name}</div>
                          <div className="text-xs">{r.email}</div>
                          <div className="text-xs">{r.phone}</div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="text-xs">{r.sections}</div>
                          <div className="text-xs text-muted-foreground">
                            {r.billing_tier} / {r.billing_period}
                          </div>
                          <div className="font-medium tabular-nums">
                            MWK {Number(r.quoted_amount).toLocaleString()}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">{r.status}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex flex-wrap gap-1.5">
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
                                setPendingRequestId(r.id);
                                setSchoolName(r.school_name);
                                setOwnerName(r.contact_name);
                                setOwnerEmail(r.email);
                                setCity(r.city || "");
                                setShowCreate(true);
                                setPlatformTab("settings");
                                toast.message(
                                  "Create form opened in Settings — confirm package and send invite",
                                );
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
        </TabsContent>

        {/* —— Settings —— */}
        <TabsContent value="settings" className="space-y-6">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl">Create school & invite owner</h2>
                <p className="text-sm text-muted-foreground">
                  Opens the school account and emails a set-password link.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCreate((v) => !v)}
              >
                {showCreate ? "Hide form" : "Show form"}
              </Button>
            </div>

            {(showCreate || pendingRequestId) && (
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
                <div className="sm:col-span-2 rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
                  <p className="text-sm font-medium">Gmail Connect (Testing mode)</p>
                  <p className="text-xs text-muted-foreground">
                    While Google OAuth is in Testing, add the owner&apos;s Gmail under Test users
                    before they can Connect Gmail. Copy the email, open Google Console, paste as a
                    test user (limit ~100).
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!ownerEmail.trim()}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(ownerEmail.trim());
                          toast.success("Owner email copied");
                        } catch {
                          window.prompt("Copy owner email:", ownerEmail.trim());
                        }
                      }}
                    >
                      Copy owner email
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        window.open(
                          googleOauthTestUsersUrl ||
                            "https://console.cloud.google.com/auth/audience?project=nsms-510209",
                          "_blank",
                          "noopener,noreferrer",
                        );
                      }}
                    >
                      Open Google test users
                    </Button>
                  </div>
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
                  <Button type="submit" disabled={busy} className="w-full sm:w-auto">
                    {busy ? "Creating…" : "Create & generate invite"}
                  </Button>
                </div>
              </form>
            )}
            {lastInviteLink && (
              <p className="mt-3 break-all text-sm text-muted-foreground">
                Invite link:{" "}
                <a className="text-primary underline" href={lastInviteLink}>
                  {lastInviteLink}
                </a>
              </p>
            )}
          </section>

          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Login & contact settings</h2>
            <p className="text-sm text-muted-foreground">
              Shown on the public login page. Change the number here — no code deploy needed.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
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
                      googleOauthTestUsersUrl,
                      platformAlertEmail,
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
        
            <section className="mt-8 rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-xl">Discounts & lucky schools</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Default discounts for activation and first subscription. Lucky draw marks a random
                share of schools (e.g. 20%) with the lucky discount on activation.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label>Lucky share of schools (%)</Label>
                  <Input value={luckySharePct} onChange={(e) => setLuckySharePct(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Lucky discount (%)</Label>
                  <Input value={luckyDiscountPct} onChange={(e) => setLuckyDiscountPct(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Default first-subscription discount (%)</Label>
                  <Input value={firstSubDiscPct} onChange={(e) => setFirstSubDiscPct(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Default activation discount (%)</Label>
                  <Input value={activationDiscPct} onChange={(e) => setActivationDiscPct(e.target.value)} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await saveDiscountSettings({
                        data: {
                          luckySharePct: Number(luckySharePct) || 20,
                          luckyDiscountPct: Number(luckyDiscountPct) || 0,
                          firstSubscriptionDiscountPct: Number(firstSubDiscPct) || 0,
                          activationDiscountPct: Number(activationDiscPct) || 0,
                        },
                      });
                      toast.success("Discount settings saved");
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  Save discount settings
                </Button>
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      const r = await runLuckySchoolDraw({ data: {} });
                      toast.success(
                        `Selected ${r.selected} of ${r.total} schools (${r.sharePct}%) at ${r.discountPct}% off activation`,
                      );
                      await invalidate();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Draw failed");
                    }
                  }}
                >
                  Run lucky school draw
                </Button>
              </div>
            </section>

            <section className="mt-8 rounded-xl border border-border bg-card p-5">
              <h2 className="font-display text-xl">Promotions</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                <strong>Signup promotion</strong> — shareable account-request link with OG image.
                <strong> Discount promotion</strong> — public page advertising a % off (activation or
                first subscription messaging).
              </p>
              <div className="mt-4 flex gap-4 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={promoKind === "SIGNUP"}
                    onChange={() => setPromoKind("SIGNUP")}
                  />
                  Account creation (signup) link
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    checked={promoKind === "DISCOUNT"}
                    onChange={() => setPromoKind("DISCOUNT")}
                  />
                  Discount promotion
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1 sm:col-span-2">
                  <Label>Title</Label>
                  <Input value={promoTitle} onChange={(e) => setPromoTitle(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>Description</Label>
                  <textarea
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={promoDesc}
                    onChange={(e) => setPromoDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label>OG image URL</Label>
                  <Input
                    value={promoOg}
                    onChange={(e) => setPromoOg(e.target.value)}
                    placeholder="https://… (upload to Cloudinary, paste URL)"
                  />
                  <p className="text-xs text-muted-foreground">
                    Upload the image in School settings / Cloudinary, then paste the public URL here.
                  </p>
                </div>
                {promoKind === "DISCOUNT" && (
                  <div className="space-y-1">
                    <Label>Discount %</Label>
                    <Input value={promoDisc} onChange={(e) => setPromoDisc(e.target.value)} />
                  </div>
                )}
              </div>
              <Button
                type="button"
                className="mt-4"
                disabled={!promoTitle.trim()}
                onClick={async () => {
                  try {
                    const r = await createPlatformPromotion({
                      data: {
                        kind: promoKind,
                        title: promoTitle.trim(),
                        description: promoDesc.trim() || undefined,
                        ogImageUrl: promoOg.trim() || undefined,
                        discountPct:
                          promoKind === "DISCOUNT" ? Number(promoDisc) || 0 : undefined,
                      },
                    });
                    setPromoShareUrl(r.shareUrl);
                    try {
                      await navigator.clipboard.writeText(r.shareUrl);
                      toast.success("Promotion created — link copied");
                    } catch {
                      toast.success("Promotion created");
                    }
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Create promotion link
              </Button>
              {promoShareUrl && (
                <p className="mt-3 break-all text-sm text-primary">{promoShareUrl}</p>
              )}
            </section>

        </TabsContent>
      </Tabs>

      {editSchool && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl bg-card p-5 shadow-lg">
            <h3 className="font-display text-lg">Edit school</h3>
            <div className="mt-3 space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input
                  value={editSchool.name}
                  onChange={(e) => setEditSchool({ ...editSchool, name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>City</Label>
                <Input
                  value={editSchool.city}
                  onChange={(e) => setEditSchool({ ...editSchool, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Area</Label>
                <Input
                  value={editSchool.area}
                  onChange={(e) => setEditSchool({ ...editSchool, area: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Owner name</Label>
                <Input
                  value={editSchool.ownerName}
                  onChange={(e) =>
                    setEditSchool({ ...editSchool, ownerName: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Owner email</Label>
                <Input
                  value={editSchool.ownerEmail}
                  onChange={(e) =>
                    setEditSchool({ ...editSchool, ownerEmail: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditSchool(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await updateSchoolByPlatform({
                      data: {
                        schoolId: editSchool.id,
                        name: editSchool.name,
                        city: editSchool.city,
                        area: editSchool.area,
                        ownerName: editSchool.ownerName,
                        ownerEmail: editSchool.ownerEmail,
                      },
                    });
                    toast.success("School updated");
                    setEditSchool(null);
                    await invalidate();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Update failed");
                  }
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}


      {/* —— Professional dialogs —— */}
      <Dialog open={!!grantDialog} onOpenChange={(o) => !o && setGrantDialog(null)}>
        <DialogContent className="max-w-md border-0 shadow-2xl sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Grant free access</DialogTitle>
            <DialogDescription>
              Activate{" "}
              <span className="font-medium text-foreground">{grantDialog?.name}</span> for a
              pilot or partner period. No payment required for this window.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duration</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={grantAmount}
                  onChange={(e) => setGrantAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={grantUnit}
                  onChange={(e) =>
                    setGrantUnit(e.target.value as typeof grantUnit)
                  }
                >
                  <option value="days">Days</option>
                  <option value="months">Months</option>
                  <option value="terms">Terms (4 months each)</option>
                  <option value="years">Years</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Label (ledger)</Label>
              <Input
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="e.g. Pilot — PEFA, Partner 2026"
              />
            </div>
            <label className="flex items-start gap-3 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={grantStack}
                onChange={(e) => setGrantStack(e.target.checked)}
              />
              <span>
                <span className="font-medium">Stack on current end date</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  Off = period starts today. On = add this time after any remaining access.
                </span>
              </span>
            </label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setGrantDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={grantBusy}
              className="bg-emerald-700 hover:bg-emerald-800"
              onClick={async () => {
                if (!grantDialog) return;
                const amount = Number(grantAmount);
                if (!amount || amount < 1) {
                  toast.error("Enter a positive duration");
                  return;
                }
                setGrantBusy(true);
                try {
                  const r = await grantSchoolAccessPeriod({
                    data: {
                      schoolId: grantDialog.id,
                      amount,
                      unit: grantUnit,
                      reason: grantReason.trim() || "Partner / pilot access",
                      stack: grantStack,
                    },
                  });
                  toast.success(
                    r.expiresAt
                      ? `Access until ${String(r.expiresAt).slice(0, 10)}`
                      : "Access granted",
                  );
                  setGrantDialog(null);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Grant failed");
                } finally {
                  setGrantBusy(false);
                }
              }}
            >
              {grantBusy ? "Granting…" : "Grant access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!pauseDialog} onOpenChange={(o) => !o && setPauseDialog(null)}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Pause school</DialogTitle>
            <DialogDescription>
              Staff and the parent app will be blocked. Show a clear reason for{" "}
              <span className="font-medium text-foreground">{pauseDialog?.name}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>Reason (visible to the school)</Label>
            <Input
              value={pauseReason}
              onChange={(e) => setPauseReason(e.target.value)}
              placeholder="e.g. Subscription fee not paid"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPauseDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pauseBusy || !pauseReason.trim()}
              className="bg-amber-600 hover:bg-amber-700"
              onClick={async () => {
                if (!pauseDialog || !pauseReason.trim()) return;
                setPauseBusy(true);
                try {
                  await transitionSchoolStatus({
                    data: {
                      schoolId: pauseDialog.id,
                      toStatus: "PAUSED" as never,
                      reason: pauseReason.trim(),
                    },
                  });
                  toast.success("School paused");
                  setPauseDialog(null);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setPauseBusy(false);
                }
              }}
            >
              {pauseBusy ? "Pausing…" : "Pause operations"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Delete school?</DialogTitle>
            <DialogDescription>
              <span className="font-medium text-foreground">{deleteDialog?.name}</span> will
              enter a <strong>14-day grace</strong> period. The owner can export data; after that
              you can purge permanently. This is not an immediate wipe.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteDialog(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteBusy}
              onClick={async () => {
                if (!deleteDialog) return;
                setDeleteBusy(true);
                try {
                  await deleteSchool({ data: { schoolId: deleteDialog.id } });
                  toast.success("School marked for deletion (14-day grace)");
                  setDeleteDialog(null);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Delete failed");
                } finally {
                  setDeleteBusy(false);
                }
              }}
            >
              {deleteBusy ? "Deleting…" : "Soft-delete school"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={wipeDialogOpen} onOpenChange={setWipeDialogOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl text-red-700">
              Wipe all schools
            </DialogTitle>
            <DialogDescription>
              Permanently removes <strong>every</strong> school and related data on this platform.
              This cannot be undone. Only use on empty test environments.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label>
              Type <code className="rounded bg-secondary px-1">DELETE ALL SCHOOLS</code> to confirm
            </Label>
            <Input
              value={wipeConfirmText}
              onChange={(e) => setWipeConfirmText(e.target.value)}
              placeholder="DELETE ALL SCHOOLS"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setWipeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={wipeBusy || wipeConfirmText !== "DELETE ALL SCHOOLS"}
              onClick={async () => {
                setWipeBusy(true);
                try {
                  const r = await wipeAllSchools();
                  toast.success(`Removed ${r.deleted} school(s)`);
                  setWipeDialogOpen(false);
                  setWipeConfirmText("");
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                } finally {
                  setWipeBusy(false);
                }
              }}
            >
              {wipeBusy ? "Wiping…" : "Wipe everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={purgeDialogOpen} onOpenChange={setPurgeDialogOpen}>
        <DialogContent className="max-w-md sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Purge expired deletions</DialogTitle>
            <DialogDescription>
              Permanently removes only schools whose <strong>14-day export grace</strong> after
              soft-delete has ended. Active and recently deleted schools are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPurgeDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={purgeBusy}
              onClick={async () => {
                setPurgeBusy(true);
                try {
                  const r = await purgeExpiredDeletedSchools();
                  toast.success(
                    r.purged
                      ? `Permanently removed ${r.purged} school(s)`
                      : "No expired soft-deletes to purge",
                  );
                  setPurgeDialogOpen(false);
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Purge failed");
                } finally {
                  setPurgeBusy(false);
                }
              }}
            >
              {purgeBusy ? "Purging…" : "Purge now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
