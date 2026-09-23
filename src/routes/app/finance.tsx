import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  applyFeeStructure,
  confirmPaychanguReturn,
  createFeeStructure,
  financeReport,
  getReceiptData,
  initiateFeePayment,
  recordPayment,
  runFeeReminders,
  voidPayment,
} from "@/lib/nexus/server";
import {
  chargeBalance,
  classLabel,
  currentTerm,
  defaultParent,
  parentChildren,
  schoolCollected,
  schoolOutstanding,
  studentBalance,
} from "@/lib/nexus/selectors";
import { formatDate, money, studentName } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";
import type { Snapshot, StudentCharge } from "@/lib/nexus/types";

function openReceiptWindow(rd: Awaited<ReturnType<typeof getReceiptData>>) {
  const w = window.open("", "_blank", "width=480,height=640");
  if (!w) return;
  const s = rd.school;
  const st = rd.student;
  const p = rd.payment;
  w.document.write(`<!DOCTYPE html><html><head><title>Receipt ${p.receipt_number || ""}</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0}
    .muted{color:#666;font-size:12px}
    table{width:100%;margin-top:16px;border-collapse:collapse}
    td{padding:6px 0;border-bottom:1px solid #eee;font-size:13px}
    .total{font-size:20px;font-weight:600;margin-top:12px}
    @media print{button{display:none}}
  </style></head><body>
  <h1>${s?.name || "School"}</h1>
  <p class="muted">${s?.address || ""} ${s?.city || ""} · ${s?.phone || ""}</p>
  <p class="muted">${s?.motto || ""}</p>
  <hr/>
  <p><strong>Official receipt</strong> ${p.receipt_number || ""}</p>
  <table>
    <tr><td>Student</td><td>${st?.name || ""} (${st?.admission_number || ""})</td></tr>
    <tr><td>Date</td><td>${p.payment_date}</td></tr>
    <tr><td>Method</td><td>${p.method}</td></tr>
    <tr><td>Reference</td><td>${p.reference || "—"}</td></tr>
    <tr><td>Status</td><td>${p.status}</td></tr>
  </table>
  <p class="total">Paid: MWK ${Number(p.amount).toLocaleString()}</p>
  <p class="muted">Thank you. Keep this receipt for your records.</p>
  <button onclick="window.print()">Print / Save PDF</button>
  </body></html>`);
  w.document.close();
}

export const Route = createFileRoute("/app/finance")({ component: FinancePage });

function FinancePage() {
  const q = useSnapshot();
  const persona = useNexusSession((s) => s.persona);
  if (q.isPending) return <Skeleton className="h-80" />;
  if (!q.data) return null;
  if (persona === "parent") return <ParentFees snap={q.data} />;
  return <StaffFinance snap={q.data} />;
}

function StaffFinance({ snap }: { snap: Snapshot }) {
  const invalidate = useInvalidateSnapshot();
  const [charge, setCharge] = useState<StudentCharge | null>(null);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [reminderResult, setReminderResult] = useState<{
    candidates: number;
    sent: number;
    failed: number;
    dryRun: boolean;
  } | null>(null);
  const [feeName, setFeeName] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeClass, setFeeClass] = useState("");
  const [feeDue, setFeeDue] = useState("");
  const [report, setReport] = useState<Awaited<ReturnType<typeof financeReport>> | null>(null);
  // Complete PayChangu return once
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tx = params.get("tx_ref");
    if (!tx) return;
    void confirmPaychanguReturn({ data: { txRef: tx } })
      .then((r) => {
        if (r.ok) toast.success("Online payment confirmed");
        void invalidate();
        window.history.replaceState({}, "", "/app/finance");
      })
      .catch(() => {});
  }, []);

  async function handleReminders(dryRun: boolean) {
    setReminderBusy(true);
    try {
      const res = await runFeeReminders({ data: { schoolId: snap.school.id, dryRun } });
      setReminderResult(res);
      if (!dryRun) {
        toast.success(
          `Sent ${res.sent} reminder(s)` + (res.failed ? `, ${res.failed} failed` : ""),
        );
      } else {
        toast.message(`Dry run: ${res.candidates} reminder(s) would be sent`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setReminderBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        kicker="Bursar"
        title="Fees & payments"
        description="Fee structures, charges, receipts, void/reverse, reminders and collection reports."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" disabled={reminderBusy} onClick={() => handleReminders(true)}>
              Preview reminders
            </Button>
            <Button disabled={reminderBusy} onClick={() => handleReminders(false)}>
              {reminderBusy ? "Sending…" : "Run fee reminders"}
            </Button>
          </div>
        }
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Collected" value={money(schoolCollected(snap))} />
        <StatCard label="Outstanding" value={money(schoolOutstanding(snap))} />
        <StatCard
          label="Receipts"
          value={String(snap.payments.filter((p) => p.status !== "VOID").length)}
        />
      </div>

      {reminderResult && (
        <section className="mt-4 rounded-xl bg-card p-4 text-sm shadow-[var(--shadow-border)]">
          <p className="text-muted-foreground">
            {reminderResult.dryRun ? "Preview" : "Last run"}: {reminderResult.candidates}{" "}
            candidate(s)
            {!reminderResult.dryRun && (
              <>
                {" "}
                · {reminderResult.sent} sent · {reminderResult.failed} failed
              </>
            )}
          </p>
        </section>
      )}

      <Tabs defaultValue="charges" className="mt-6">
        <TabsList>
          <TabsTrigger value="charges">Charges</TabsTrigger>
          <TabsTrigger value="structures">Fee structures</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="charges" className="mt-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Student charges</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <tr>
                    <th className="py-2 font-medium">Student</th>
                    <th className="py-2 font-medium">Item</th>
                    <th className="py-2 font-medium">Amount</th>
                    <th className="py-2 font-medium">Paid</th>
                    <th className="py-2 font-medium">Status</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {snap.charges.map((c) => {
                    const s = snap.students.find((x) => x.id === c.student_id);
                    return (
                      <tr key={c.id} className="border-t border-border">
                        <td className="py-2">{s ? studentName(s) : "—"}</td>
                        <td className="py-2">{c.description}</td>
                        <td className="py-2 tabular-nums">{money(c.amount)}</td>
                        <td className="py-2 tabular-nums">{money(c.paid)}</td>
                        <td className="py-2">
                          <StatusPill value={c.status} />
                        </td>
                        <td className="py-2 text-right">
                          {chargeBalance(c) > 0 ? (
                            <Button size="sm" variant="outline" onClick={() => setCharge(c)}>
                              Record
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Settled</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </TabsContent>

        <TabsContent value="structures" className="mt-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Create fee structure</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input
                  value={feeName}
                  onChange={(e) => setFeeName(e.target.value)}
                  placeholder="Tuition Term 2"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Amount (MWK)</Label>
                <Input
                  type="number"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Class (optional = all)</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={feeClass}
                  onChange={(e) => setFeeClass(e.target.value)}
                >
                  <option value="">All students</option>
                  {snap.classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {classLabel(c)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={feeDue} onChange={(e) => setFeeDue(e.target.value)} />
              </div>
            </div>
            <Button
              className="mt-4"
              onClick={async () => {
                if (!feeName || !feeAmount) {
                  toast.error("Name and amount required");
                  return;
                }
                try {
                  const term = currentTerm(snap);
                  const res = await createFeeStructure({
                    data: {
                      schoolId: snap.school.id,
                      name: feeName,
                      amount: Number(feeAmount),
                      classId: feeClass || undefined,
                      termId: term?.id,
                      dueDate: feeDue || undefined,
                      mandatory: true,
                    },
                  });
                  toast.success("Fee structure created");
                  const apply = await applyFeeStructure({
                    data: { schoolId: snap.school.id, feeStructureId: res.id },
                  });
                  toast.success(`Charged ${apply.created} student(s)`);
                  setFeeName("");
                  setFeeAmount("");
                  await invalidate();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Create & apply to students
            </Button>
            <h3 className="mt-6 text-sm font-medium">Existing structures</h3>
            <ul className="mt-2 divide-y divide-border text-sm">
              {snap.fees.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2"
                >
                  <span>
                    {f.name} · {money(f.amount)}
                    {f.class_id
                      ? ` · ${classLabel(snap.classes.find((c) => c.id === f.class_id))}`
                      : " · All"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const r = await applyFeeStructure({
                          data: { schoolId: snap.school.id, feeStructureId: f.id },
                        });
                        toast.success(`Applied to ${r.created} new student(s)`);
                        await invalidate();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    }}
                  >
                    Re-apply
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="receipts" className="mt-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-xl">Receipts</h2>
            <ul className="mt-3 divide-y divide-border">
              {snap.payments.map((p) => {
                const s = snap.students.find((x) => x.id === p.student_id);
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      {p.receipt_number} · {s ? studentName(s) : ""} · {p.method}
                      {p.status === "VOID" ? " · VOID" : ""}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">
                        {money(p.amount)} · {formatDate(p.payment_date)}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            const rd = await getReceiptData({ data: { paymentId: p.id } });
                            openReceiptWindow(rd);
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Failed");
                          }
                        }}
                      >
                        Print
                      </Button>
                      {p.status !== "VOID" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const reason = window.prompt("Reason for voiding this payment?");
                            if (!reason) return;
                            try {
                              await voidPayment({ data: { paymentId: p.id, reason } });
                              toast.success("Payment voided");
                              await invalidate();
                            } catch (e) {
                              toast.error(e instanceof Error ? e.message : "Failed");
                            }
                          }}
                        >
                          Void
                        </Button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-xl">Collection report</h2>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    setReport(await financeReport({ data: { schoolId: snap.school.id } }));
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed");
                  }
                }}
              >
                Refresh report
              </Button>
            </div>
            {report && (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <StatCard label="Charged" value={money(report.totals.charged)} />
                  <StatCard label="Collected" value={money(report.totals.collected)} />
                  <StatCard label="Outstanding" value={money(report.totals.outstanding)} />
                </div>
                <h3 className="mt-6 text-sm font-medium">By class</h3>
                <table className="mt-2 w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr>
                      <th className="py-1">Class</th>
                      <th className="py-1">Students</th>
                      <th className="py-1">Charged</th>
                      <th className="py-1">Collected</th>
                      <th className="py-1">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byClass.map((r) => (
                      <tr key={r.classId} className="border-t border-border">
                        <td className="py-1">{r.className}</td>
                        <td className="py-1 tabular-nums">{r.students}</td>
                        <td className="py-1 tabular-nums">{money(r.charged)}</td>
                        <td className="py-1 tabular-nums">{money(r.collected)}</td>
                        <td className="py-1 tabular-nums">{money(r.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <h3 className="mt-6 text-sm font-medium">By payment method</h3>
                <ul className="mt-2 text-sm">
                  {Object.entries(report.byMethod).map(([m, a]) => (
                    <li
                      key={m}
                      className="flex justify-between border-t border-border py-1"
                    >
                      <span>{m}</span>
                      <span className="tabular-nums">{money(a as number)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </TabsContent>
      </Tabs>

      <PayDialog charge={charge} onClose={() => setCharge(null)} />
    </div>
  );
}

function PayDialog({
  charge,
  onClose,
}: {
  charge: StudentCharge | null;
  onClose: () => void;
}) {
  const invalidate = useInvalidateSnapshot();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [ref, setRef] = useState("");
  const [busy, setBusy] = useState(false);
  const due = charge ? chargeBalance(charge) : 0;
  return (
    <Dialog open={!!charge} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {charge?.description} · outstanding {money(due)}
        </p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount (MK)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(due)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Airtel Money">Airtel Money</SelectItem>
                <SelectItem value="TNM Mpamba">TNM Mpamba</SelectItem>
                <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                <SelectItem value="Online gateway">Online gateway</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            disabled={busy || !charge}
            onClick={async () => {
              if (!charge) return;
              setBusy(true);
              try {
                const res = await recordPayment({
                  data: {
                    chargeId: charge.id,
                    amount: Number(amount) || due,
                    method,
                    reference: ref || undefined,
                  },
                });
                toast.success(`Receipt ${res.receipt}`);
                if (res.paymentId) {
                  try {
                    openReceiptWindow(
                      await getReceiptData({ data: { paymentId: res.paymentId } }),
                    );
                  } catch {
                    /* ignore */
                  }
                }
                onClose();
                await invalidate();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Payment failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            Verify & receipt
          </Button>
          <Button
            variant="secondary"
            disabled={busy || !charge}
            onClick={async () => {
              if (!charge) return;
              setBusy(true);
              try {
                const res = await initiateFeePayment({
                  data: { chargeId: charge.id, returnPath: "/app/finance" },
                });
                if (res.checkoutUrl) {
                  toast.message(
                    false
                      ? "PayChangu is not configured — online checkout unavailable"
                      : "Redirecting to PayChangu (MoMo / bank / card)…",
                  );
                  window.location.href = res.checkoutUrl;
                } else {
                  toast.error("No checkout URL returned");
                  setBusy(false);
                }
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Payment start failed");
                setBusy(false);
              }
            }}
          >
            Pay online (MoMo / Card / Bank)
          </Button>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParentFees({ snap }: { snap: Snapshot }) {
  const parent = defaultParent(snap);
  const children = parent ? parentChildren(snap, parent.id) : [];
  return (
    <div>
      <h1 className="font-display text-3xl text-foam">Payment centre</h1>
      <p className="mt-1 text-sm text-mist">Outstanding balances for linked children.</p>
      <div className="mt-6 space-y-4">
        {children.map((c) => {
          const charges = snap.charges.filter((x) => x.student_id === c.id);
          return (
            <section
              key={c.id}
              className="rounded-xl border border-foam/10 bg-ink-2 p-4 text-foam"
            >
              <p className="font-medium">{studentName(c)}</p>
              <p className="text-2xl tabular-nums">{money(studentBalance(snap, c.id))}</p>
              <ul className="mt-3 space-y-2 text-sm">
                {charges.map((ch) => (
                  <li
                    key={ch.id}
                    className="flex justify-between border-t border-foam/10 pt-2"
                  >
                    <span>
                      {ch.description} · {money(chargeBalance(ch))} due
                    </span>
                    <StatusPill value={ch.status} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <section className="mt-6">
        <h2 className="font-display text-xl text-foam">Receipts</h2>
        <ul className="mt-3 space-y-2">
          {snap.payments
            .filter((p) => children.some((c) => c.id === p.student_id))
            .map((p) => (
              <li
                key={p.id}
                className="flex justify-between rounded-xl border border-foam/10 px-4 py-3 text-sm text-foam"
              >
                <span>
                  {p.receipt_number} · {p.method}
                </span>
                <span className="tabular-nums">{money(p.amount)}</span>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
