import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  generatePlatformInvoices,
  getPlatformPriceList,
  getSubscriptionDueAlerts,
  listPlatformInvoices,
  markPlatformInvoicePaid,
  savePlatformPriceList,
  sendPlatformInvoice,
  initiatePlatformInvoicePayment,
} from "@/lib/nexus/server";
import {
  BILLING_TIER_OPTIONS,
  SUBSCRIPTION_PRICES,
  formatMwk,
  type BillingPeriod,
} from "@/lib/nexus/billing";
import { money } from "@/lib/utils";

export const Route = createFileRoute("/app/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof listPlatformInvoices>> | null>(
    null,
  );
  const [alerts, setAlerts] = useState<
    Awaited<ReturnType<typeof getSubscriptionDueAlerts>>["alerts"]
  >([]);
  const [prices, setPrices] = useState(SUBSCRIPTION_PRICES);
  const [priceBusy, setPriceBusy] = useState(false);
  const [editingPrices, setEditingPrices] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const [inv, al, pl] = await Promise.all([
        listPlatformInvoices(),
        getSubscriptionDueAlerts(),
        getPlatformPriceList({ data: {} }).catch(() => null),
      ]);
      setData(inv);
      setAlerts(al.alerts);
      if (pl?.prices) setPrices(pl.prices as typeof SUBSCRIPTION_PRICES);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function handleGenerate(dryRun: boolean) {
    setBusy(true);
    try {
      const res = await generatePlatformInvoices({ data: { period: "monthly", dryRun } });
      toast.success(
        dryRun
          ? `Would create ${res.count} invoice(s)`
          : `Generated ${res.count} invoice(s)`,
      );
      if (!dryRun) await refresh();
      else if (res.invoices[0]) {
        toast.message(
          res.invoices
            .slice(0, 3)
            .map((i) => `${i.schoolName}: ${formatMwk(i.amount)}`)
            .join(" · "),
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Skeleton className="h-64" />;

  const overdue = alerts.filter((a) => a.urgency === "overdue");
  const dueSoon = alerts.filter((a) => a.urgency === "due_soon");

  return (
    <div>
      <PageHeader
        kicker="Platform"
        title="Subscription invoices"
        description="Month-end invoices for schools. Primary / Secondary / Both pricing. Sent by email and platform httpSMS."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={busy} onClick={() => handleGenerate(true)}>
              Preview month-end
            </Button>
            <Button disabled={busy} onClick={() => handleGenerate(false)}>
              {busy ? "Working…" : "Generate invoices"}
            </Button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Unpaid" value={String(data?.unpaidCount ?? 0)} />
        <StatCard label="Due within 7 days" value={String(data?.dueSoonCount ?? 0)} />
        <StatCard label="Overdue" value={String(overdue.length)} />
      </div>

      {/* Owner reminders */}
      {(overdue.length > 0 || dueSoon.length > 0) && (
        <section className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <h2 className="font-display text-xl">Schools that need to pay</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            System reminder for you (platform owner). Follow up so subscriptions stay active.
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            {[...overdue, ...dueSoon].map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-3 py-2"
              >
                <span>
                  <strong>{a.schoolName}</strong> · {a.invoice_number} · {a.amountLabel}
                  <span className="text-muted-foreground">
                    {" "}
                    ·{" "}
                    {a.urgency === "overdue"
                      ? `${Math.abs(a.daysUntilDue)} day(s) overdue`
                      : `due in ${a.daysUntilDue} day(s)`}
                  </span>
                </span>
                <StatusPill value={a.urgency === "overdue" ? "OVERDUE" : "DUE_SOON"} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Price card — editable */}
      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Price list (MWK)</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Used for new invoices and school quotes. Defaults match your published tiers; edit and
              save to override.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!editingPrices ? (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditingPrices(true)}>
                Edit prices
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingPrices(false);
                    void refresh();
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={priceBusy}
                  onClick={async () => {
                    setPriceBusy(true);
                    try {
                      await savePlatformPriceList({ data: { prices } });
                      toast.success("Price list saved");
                      setEditingPrices(false);
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Save failed");
                    } finally {
                      setPriceBusy(false);
                    }
                  }}
                >
                  {priceBusy ? "Saving…" : "Save prices"}
                </Button>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="py-2">Tier</th>
                <th className="py-2">Monthly</th>
                <th className="py-2">Per term</th>
                <th className="py-2">Academic year</th>
              </tr>
            </thead>
            <tbody>
              {BILLING_TIER_OPTIONS.map((o) => (
                <tr key={o.value} className="border-t border-border">
                  <td className="py-2 pr-2">{o.label}</td>
                  {(["monthly", "term", "annual"] as BillingPeriod[]).map((per) => (
                    <td key={per} className="py-2 tabular-nums">
                      {editingPrices ? (
                        <input
                          type="number"
                          className="w-28 rounded-md border border-input bg-background px-2 py-1 text-sm"
                          value={prices[o.value]?.[per] ?? 0}
                          onChange={(e) => {
                            const n = Number(e.target.value) || 0;
                            setPrices((prev) => ({
                              ...prev,
                              [o.value]: { ...prev[o.value], [per]: n },
                            }));
                          }}
                        />
                      ) : (
                        formatMwk(prices[o.value]?.[per] ?? 0)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 overflow-x-auto rounded-xl bg-card shadow-[var(--shadow-border)]">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">School</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Due</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(data?.invoices || []).map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-medium">{inv.invoice_number}</td>
                <td className="px-4 py-3">
                  <p>{inv.schoolName}</p>
                  <p className="text-xs text-muted-foreground">{inv.schoolEmail}</p>
                </td>
                <td className="px-4 py-3">
                  {inv.billing_tier} / {inv.billing_period}
                </td>
                <td className="px-4 py-3 tabular-nums">{money(inv.amount)}</td>
                <td className="px-4 py-3">{inv.due_date}</td>
                <td className="px-4 py-3">
                  <StatusPill value={inv.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {inv.status !== "PAID" && inv.status !== "VOID" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            try {
                              const r = await sendPlatformInvoice({
                                data: { invoiceId: inv.id },
                              });
                              toast.success(
                                `Sent${r.emailOk ? " email" : ""}${r.smsOk ? " SMS" : ""}`,
                              );
                              await refresh();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed");
                            }
                          }}
                        >
                          Send
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            try {
                              const r = await initiatePlatformInvoicePayment({
                                data: { invoiceId: inv.id },
                              });
                              if (r.checkoutUrl) {
                                window.location.href = r.checkoutUrl;
                              } else {
                                toast.error("No checkout URL");
                              }
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed");
                            }
                          }}
                        >
                          Pay online
                        </Button>
                        <Button
                          size="sm"
                          onClick={async () => {
                            try {
                              await markPlatformInvoicePaid({
                                data: { invoiceId: inv.id },
                              });
                              toast.success("Marked paid");
                              await refresh();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed");
                            }
                          }}
                        >
                          Mark paid
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {(data?.invoices || []).length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No invoices yet. Click “Generate invoices” at month-end (or preview first).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
