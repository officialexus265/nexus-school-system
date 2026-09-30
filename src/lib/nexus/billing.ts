/**
 * Platform subscription pricing (MWK) by school sections offered.
 *
 * Single section:
 *   Nursery:    70,000 / mo · 180,000 / term · 490,000 / year
 *   Primary:    70,000 / mo · 180,000 / term · 490,000 / year
 *   Secondary:  90,000 / mo · 250,000 / term · 700,000 / year
 *
 * Combinations:
 *   Nursery + Primary:              110,000 / 300,000 / 900,000
 *   Nursery + Secondary:            130,000 / 350,000 / 950,000
 *   Primary + Secondary (no nursery): 130,000 / 350,000 / 950,000
 *   All three (nursery+primary+secondary): 200,000 / 500,000 / 1,200,000
 */

export type BillingTier =
  | "nursery"
  | "primary"
  | "secondary"
  | "nursery_primary"
  | "nursery_secondary"
  | "primary_secondary"
  | "all";

export type BillingPeriod = "monthly" | "term" | "annual";

export const SUBSCRIPTION_PRICES: Record<
  BillingTier,
  Record<BillingPeriod, number>
> = {
  nursery: { monthly: 70_000, term: 180_000, annual: 490_000 },
  primary: { monthly: 70_000, term: 180_000, annual: 490_000 },
  secondary: { monthly: 90_000, term: 250_000, annual: 700_000 },
  nursery_primary: { monthly: 110_000, term: 300_000, annual: 900_000 },
  nursery_secondary: { monthly: 130_000, term: 350_000, annual: 950_000 },
  primary_secondary: { monthly: 130_000, term: 350_000, annual: 950_000 },
  all: { monthly: 200_000, term: 500_000, annual: 1_200_000 },
};

/** Ordered list for dropdowns / price tables */
export const BILLING_TIER_OPTIONS: { value: BillingTier; label: string }[] = [
  { value: "nursery", label: "Nursery only" },
  { value: "primary", label: "Primary only" },
  { value: "secondary", label: "Secondary only" },
  { value: "nursery_primary", label: "Nursery + Primary" },
  { value: "nursery_secondary", label: "Nursery + Secondary" },
  { value: "primary_secondary", label: "Primary + Secondary (no nursery)" },
  { value: "all", label: "All sections (Nursery + Primary + Secondary)" },
];

export function tierLabel(tier: BillingTier | string): string {
  return BILLING_TIER_OPTIONS.find((o) => o.value === tier)?.label || tier;
}

export function priceFor(tier: BillingTier, period: BillingPeriod): number {
  const row = SUBSCRIPTION_PRICES[tier] || SUBSCRIPTION_PRICES.primary_secondary;
  return row[period];
}

/** Map legacy "both" stored values to all three sections */
export function normalizeBillingTier(raw: string | null | undefined): BillingTier {
  const t = (raw || "").toLowerCase().trim();
  if (t === "both") return "all"; // legacy: full school = nursery + primary + secondary
  if (t in SUBSCRIPTION_PRICES) return t as BillingTier;
  return inferBillingTier(raw);
}

/** Infer tier from school_type / sections text. */
export function inferBillingTier(schoolType: string | null | undefined): BillingTier {
  const t = (schoolType || "").toLowerCase();
  const hasNursery = t.includes("nursery") || t.includes("baby") || t.includes("reception");
  const hasPrimary = t.includes("primary") || t.includes("standard");
  const hasSecondary =
    t.includes("secondary") || t.includes("form") || t.includes("high");

  if (hasNursery && hasPrimary && hasSecondary) return "all";
  if (hasNursery && hasPrimary) return "nursery_primary";
  if (hasNursery && hasSecondary) return "nursery_secondary";
  if (hasPrimary && hasSecondary) return "primary_secondary";
  if (hasNursery) return "nursery";
  if (hasSecondary) return "secondary";
  if (hasPrimary) return "primary";
  if (t.includes("&") || t.includes("and")) return "all";
  return "all";
}

export function schoolTypeFromTier(tier: BillingTier): string {
  switch (tier) {
    case "nursery":
      return "Nursery";
    case "primary":
      return "Primary";
    case "secondary":
      return "Secondary";
    case "nursery_primary":
      return "Nursery & Primary";
    case "nursery_secondary":
      return "Nursery & Secondary";
    case "primary_secondary":
      return "Primary & Secondary";
    case "all":
      return "Nursery, Primary & Secondary";
    default:
      return "Primary & Secondary";
  }
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
    const due = new Date(y, m, 15);
    return { start, end, due };
  }
  if (period === "term") {
    const termIndex = m < 4 ? 0 : m < 8 ? 1 : 2;
    const startMonth = termIndex * 4;
    const start = new Date(y, startMonth, 1);
    const end = new Date(y, startMonth + 4, 0);
    const due = new Date(y, startMonth, 20);
    return { start, end, due };
  }
  const start = new Date(y, 0, 1);
  const end = new Date(y, 11, 31);
  const due = new Date(y, 0, 31);
  return { start, end, due };
}

export function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}


/** Fixed calendar: 1 month | 1 term = 4 months | 1 year = 12 months (3 terms). */
export const PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  term: 4,
  annual: 12,
};

export function periodMonths(period: BillingPeriod): number {
  return PERIOD_MONTHS[period] ?? 1;
}

/**
 * Upgrade: credit unused value of current plan toward a longer/higher plan.
 * Example: paid term 4, upgrade to year 10 → pay max(0, 10 - 4) = 6.
 * Uses list prices (same tier).
 */
export function upgradePrice(
  tier: BillingTier,
  fromPeriod: BillingPeriod,
  toPeriod: BillingPeriod,
): { amountDue: number; credit: number; targetPrice: number } {
  const from = priceFor(tier, fromPeriod);
  const to = priceFor(tier, toPeriod);
  const credit = from; // full list price of current package as credit when upgrading mid-cycle
  const amountDue = Math.max(0, to - credit);
  return { amountDue, credit, targetPrice: to };
}

/** Extend: pay full price of the additional period (stacked on current end date). */
export function extendPrice(tier: BillingTier, period: BillingPeriod): number {
  return priceFor(tier, period);
}
