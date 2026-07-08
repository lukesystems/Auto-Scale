/**
 * Credit-based plan definitions (decided 2026-07-08).
 *
 * Output-weighted credits: intelligence phases (brief, discovery, trends,
 * strategy, scripts) are free with an active subscription; credits are spent
 * on outputs only. Plan credits reset each billing cycle; top-up credits
 * never expire.
 */

export type PlanId = "launch" | "growth" | "operator";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceMonthly: number;
  creditsPerMonth: number;
  maxProjects: number;
}

export const PLANS: Record<PlanId, PlanDefinition> = {
  launch: { id: "launch", name: "Launch", priceMonthly: 49, creditsPerMonth: 25, maxProjects: 1 },
  growth: { id: "growth", name: "Growth", priceMonthly: 149, creditsPerMonth: 80, maxProjects: 3 },
  operator: { id: "operator", name: "Operator", priceMonthly: 399, creditsPerMonth: 250, maxProjects: 10 },
};

export function isPlanId(value: string | null | undefined): value is PlanId {
  return value === "launch" || value === "growth" || value === "operator";
}

/** Credit cost per billable action. */
export const CREDIT_COSTS = {
  growth_run_start: 2,
  video_render: 1,
  video_render_premium: 3,
} as const;

export type BillableAction = keyof typeof CREDIT_COSTS;

export interface TopupPack {
  /** Matches LEMONSQUEEZY_TOPUP_VARIANT_* env naming. */
  key: "small" | "medium" | "large";
  name: string;
  price: number;
  credits: number;
}

export const TOPUP_PACKS: TopupPack[] = [
  { key: "small", name: "10 credits", price: 19, credits: 10 },
  { key: "medium", name: "40 credits", price: 69, credits: 40 },
  { key: "large", name: "100 credits", price: 149, credits: 100 },
];
