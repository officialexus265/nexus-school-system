import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader, StatCard } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import { recordPayment } from "@/lib/nexus/server";
import {
  chargeBalance,
  defaultParent,
  parentChildren,
  schoolCollected,
  schoolOutstanding,
  studentBalance,
} from "@/lib/nexus/selectors";
import { formatDate, money, studentName } from "@/lib/utils";
import { useNexusSession } from "@/stores/session";
import type { Snapshot, StudentCharge } from "@/lib/nexus/types";

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
  const [charge, setCharge] = useState<StudentCharge | null>(null);
  return (
    <div>
      <PageHeader
        kicker="Bursar"
        title="Fees & payments"
        description="Transactions are verified, allocated and receipted. Use void or reverse — never delete."
      />
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Collected" value={money(schoolCollected(snap))} />
        <StatCard label="Outstanding" value={money(schoolOutstanding(snap))} />
        <StatCard label="Receipts this term" value={String(snap.payments.length)} />
      </div>
      <section className="mt-6 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Student charges</h2>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              <tr>
                <th className="py-2 font-medium">Student</th>
                <th className="py-2 font-medium">Item</th>
                <th className="py-2 font-medium">Due</th>
                <th className="py-2 font-medium">Paid</th>
                <th className="py-2 font-medium">Balance</th>
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
      <section className="mt-4 rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
        <h2 className="font-display text-xl">Receipts</h2>
        <ul className="mt-3 divide-y divide-border">
          {snap.payments.map((p) => {
            const s = snap.students.find((x) => x.id === p.student_id);
            return (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  {p.receipt_number} · {s ? studentName(s) : ""} · {p.method}
                </span>
                <span className="tabular-nums">
                  {money(p.amount)} · {formatDate(p.payment_date)}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      <PayDialog charge={charge} onClose={() => setCharge(null)} />
    </div>
  );
}

function PayDialog({ charge, onClose }: { charge: StudentCharge | null; onClose: () => void }) {
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
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(due)} />
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
                <SelectItem value="Bank transfer">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ParentFees({ snap }: { snap: Snapshot }) {
  const parent = defaultParent(snap);
  const children = parent ? parentChildren(snap, parent.id) : [];
  const [charge, setCharge] = useState<StudentCharge | null>(null);
  return (
    <div>
      <h1 className="font-display text-3xl text-foam">Payment centre</h1>
      <p className="mt-1 text-sm text-mist">Choose a charge, pay, and keep the receipt.</p>
      <div className="mt-6 space-y-4">
        {children.map((c) => {
          const charges = snap.charges.filter((x) => x.student_id === c.id);
          return (
            <section key={c.id} className="rounded-xl border border-foam/10 bg-ink-2 p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display text-xl text-foam">{studentName(c)}</h2>
                <p className="tabular-nums text-sm text-mist">{money(studentBalance(snap, c.id))} due</p>
              </div>
              <ul className="mt-3 divide-y divide-foam/10">
                {charges.map((ch) => (
                  <li key={ch.id} className="flex items-center justify-between py-2 text-sm text-foam">
                    <span>
                      {ch.description}
                      <span className="ml-2 text-mist">
                        {money(ch.paid)} / {money(ch.amount)}
                      </span>
                    </span>
                    {chargeBalance(ch) > 0 ? (
                      <Button
                        size="sm"
                        className="bg-foam text-ink hover:bg-foam/90"
                        onClick={() => setCharge(ch)}
                      >
                        Pay
                      </Button>
                    ) : (
                      <StatusPill value="PAID" />
                    )}
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
              <li key={p.id} className="flex justify-between rounded-xl border border-foam/10 px-4 py-3 text-sm text-foam">
                <span>
                  {p.receipt_number} · {p.method}
                </span>
                <span className="tabular-nums">{money(p.amount)}</span>
              </li>
            ))}
        </ul>
      </section>
      <PayDialog charge={charge} onClose={() => setCharge(null)} />
    </div>
  );
}

