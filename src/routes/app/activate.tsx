import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NexusMark } from "@/components/brand/mark";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInvalidateSnapshot, useSnapshot } from "@/hooks/use-snapshot";
import {
  confirmPaychanguReturn,
  getSchoolActivationInvoice,
  initiateActivationPayment,
} from "@/lib/nexus/server";
import { formatMwk } from "@/lib/nexus/billing";

export const Route = createFileRoute("/app/activate")({
  component: ActivatePage,
});

function ActivatePage() {
  const q = useSnapshot();
  const invalidate = useInvalidateSnapshot();
  const [info, setInfo] = useState<Awaited<
    ReturnType<typeof getSchoolActivationInvoice>
  > | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const tx = new URLSearchParams(window.location.search).get("tx_ref");
    if (tx) {
      void confirmPaychanguReturn({ data: { txRef: tx } })
        .then(async (r) => {
          if (r.ok) {
            toast.success("Activation payment confirmed");
            await invalidate();
            window.location.href = "/app/setup";
          }
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    const id = q.data?.school?.id;
    if (!id || id === "none") return;
    void getSchoolActivationInvoice({ data: { schoolId: id } })
      .then(setInfo)
      .catch((e) => toast.error(e instanceof Error ? e.message : "Failed"));
  }, [q.data?.school?.id]);

  if (q.isPending || !info) {
    return (
      <div className="mx-auto max-w-lg p-8">
        <Skeleton className="h-48" />
      </div>
    );
  }

  if (info.paid) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <NexusMark className="mx-auto size-12" />
        <h1 className="font-display text-2xl">School activated</h1>
        <p className="text-sm text-muted-foreground">
          {info.schoolName} is ready. Continue to the setup wizard.
        </p>
        <Button onClick={() => (window.location.href = "/app/setup")}>
          Open setup wizard
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6 sm:p-10">
      <div className="text-center">
        <NexusMark className="mx-auto size-12" />
        <h1 className="mt-4 font-display text-2xl tracking-tight">
          Activate your school
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Pay the one-time activation fee for <strong>{info.schoolName}</strong>{" "}
          to unlock NEXUS. Setup continues after payment.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-[var(--shadow-border)]">
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">Listed fee</span>
          <span className="tabular-nums">{formatMwk(info.listFee)}</span>
        </div>
        {info.discountPct > 0 && (
          <div className="mt-2 flex items-baseline justify-between gap-4 text-emerald-700">
            <span className="text-sm">
              Discount{info.isLuckySchool ? " (lucky school)" : ""}
            </span>
            <span className="tabular-nums">−{info.discountPct}%</span>
          </div>
        )}
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-border pt-4">
          <span className="font-medium">Amount due</span>
          <span className="text-2xl font-semibold tabular-nums">
            {formatMwk(info.amountDue)}
          </span>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Pay with Airtel Money, TNM Mpamba, bank, or card via PayChangu.
        </p>
        <Button
          className="mt-6 w-full"
          size="lg"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const r = await initiateActivationPayment({
                data: { schoolId: info.schoolId },
              });
              if (r.freeActivation || r.alreadyPaid) {
                toast.success("Activated");
                await invalidate();
                window.location.href = "/app/setup";
                return;
              }
              if (r.checkoutUrl) {
                window.location.href = r.checkoutUrl;
              } else {
                toast.error("No checkout URL returned");
              }
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Payment failed");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Opening PayChangu…" : `Pay ${formatMwk(info.amountDue)}`}
        </Button>
      </div>
    </div>
  );
}
