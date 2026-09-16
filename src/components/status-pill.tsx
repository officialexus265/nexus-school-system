import { Badge } from "@/components/ui/badge";

const MAP: Record<string, { variant: "ok" | "warn" | "danger" | "muted" | "default" | "ink"; label?: string }> = {
  ACTIVE: { variant: "ok" },
  VERIFIED: { variant: "ok" },
  PUBLISHED: { variant: "ok" },
  LOCKED: { variant: "ink" },
  PAID: { variant: "ok" },
  PRESENT: { variant: "ok" },
  CLOSED: { variant: "ok" },
  POSITIVE: { variant: "ok" },
  PENDING_PAYMENT: { variant: "warn", label: "Pending payment" },
  GRACE_PERIOD: { variant: "warn", label: "Grace period" },
  DORMANT: { variant: "muted" },
  PARTIAL: { variant: "warn" },
  LATE: { variant: "warn" },
  EXCUSED: { variant: "muted" },
  SUBMITTED: { variant: "default" },
  UNDER_REVIEW: { variant: "warn", label: "Under review" },
  APPROVED: { variant: "default" },
  READY_TO_PUBLISH: { variant: "default", label: "Ready" },
  DRAFT: { variant: "muted" },
  RETURNED: { variant: "danger" },
  SUSPENDED: { variant: "danger" },
  CANCELLED: { variant: "muted" },
  UNPAID: { variant: "danger" },
  ABSENT: { variant: "danger" },
  NEGATIVE: { variant: "danger" },
  OPEN: { variant: "warn" },
  MARKED: { variant: "ok" },
};

export function StatusPill({ value }: { value: string }) {
  const meta = MAP[value] ?? { variant: "muted" as const };
  const label = meta.label ?? value.replaceAll("_", " ").toLowerCase();
  return <Badge variant={meta.variant}>{label}</Badge>;
}
