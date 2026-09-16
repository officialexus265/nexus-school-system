/**
 * Platform subscription pricing (MWK).
 *
 * Primary only:   70,000 / month · 180,000 / term · 490,000 / year
 * Secondary only: 90,000 / month · 250,000 / term · 700,000 / year
 * Both:          130,000 / month · 350,000 / term · 950,000 / year
 */

export type BillingTier = "primary" | "secondary" | "both";
export type BillingPeriod = "monthly" | "term" | "annual";

export const SUBSCRIPTION_PRICES: Record<
  BillingTier,
  Record<BillingPeriod, number>
> = {
  primary: { monthly: 70_000, term: 180_000, annual: 490_000 },
  secondary: { monthly: 90_000, term: 250_000, annual: 700_000 },
  both: { monthly: 130_000, term: 350_000, annual: 950_000 },
};

export function priceFor(tier: BillingTier, period: BillingPeriod): number {
  return SUBSCRIPTION_PRICES[tier][period];
}

/** Infer tier from school_type text (flexible matching). */
export function inferBillingTier(schoolType: string | null | undefined): BillingTier {
  const t = (schoolType || "").toLowerCase();
  const hasPrimary = t.includes("primary") || t.includes("standard");
  const hasSecondary =
    t.includes("secondary") || t.includes("form") || t.includes("high");
  if (hasPrimary && hasSecondary) return "both";
  if (hasSecondary) return "secondary";
  if (hasPrimary) return "primary";
  // Default both for "Primary & Secondary" style seed data
  if (t.includes("&") || t.includes("and")) return "both";
  return "both";
}

export function periodLabel(period: BillingPeriod): string {
  return period === "monthly" ? "month" : period === "term" ? "term" : "academic year";
}

export function formatMwk(amount: number): string {
  return `MWK ${Math.round(amount).toLocaleString("en-MW")}`;
}

/** Calendar period bounds for invoice generation. */
export function periodBounds(
  period: BillingPeriod,
  ref: Date = new Date(),
): { start: Date; end: Date; due: Date } {
  const y = ref.getFullYear();
  const m = ref.getMonth();
  if (period === "monthly") {
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0);
    const due = new Date(y, m, 15); // due mid-month
    return { start, end, due };
  }
  if (period === "term") {
    // Rough Malawi-style terms: Jan–Apr, May–Aug, Sep–Dec
    const termIndex = m < 4 ? 0 : m < 8 ? 1 : 2;
    const startMonth = termIndex * 4;
    const start = new Date(y, startMonth, 1);
    const end = new Date(y, startMonth + 4, 0);
    const due = new Date(y, startMonth, 20);
    return { start, end, due };
  }
  // annual academic year approx Jan–Dec
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31);
  const due = new Date(y, 0, 31);
  return { start, end, due };
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}
