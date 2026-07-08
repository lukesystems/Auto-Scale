import "server-only";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { CREDIT_COSTS, PLANS, isPlanId, type BillableAction, type PlanId } from "./plans";

export interface CreditBalance {
  planCredits: number;
  topupCredits: number;
  total: number;
}

export class InsufficientCreditsError extends Error {
  constructor(public required: number, public available: number) {
    super(
      `Not enough credits: this needs ${required}, you have ${available}. Top up or upgrade your plan to continue.`
    );
    this.name = "InsufficientCreditsError";
  }
}

export class SubscriptionRequiredError extends Error {
  constructor() {
    super("An active subscription is required. Choose a plan to start your Growth Run.");
    this.name = "SubscriptionRequiredError";
  }
}

/**
 * Billing is enforced only when Lemon Squeezy is configured, so local dev and
 * preview environments run free until real keys land. BILLING_ENFORCED=0
 * force-disables enforcement even with keys present (staging/testing).
 */
export function isBillingEnforced(): boolean {
  if (process.env.BILLING_ENFORCED?.trim() === "0") return false;
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY?.trim() && process.env.LEMONSQUEEZY_STORE_ID?.trim()
  );
}

export async function getCreditBalance(ownerId: string): Promise<CreditBalance> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("credit_balances")
    .select("plan_credits, topup_credits")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const planCredits = data?.plan_credits ?? 0;
  const topupCredits = data?.topup_credits ?? 0;
  return { planCredits, topupCredits, total: planCredits + topupCredits };
}

export interface SubscriptionState {
  active: boolean;
  plan: PlanId | null;
  status: string;
  renewsAt: string | null;
}

const ACTIVE_STATUSES = new Set(["active", "on_trial", "past_due"]);

export async function getSubscriptionState(ownerId: string): Promise<SubscriptionState> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("profiles")
    .select("plan, subscription_status, subscription_renews_at")
    .eq("id", ownerId)
    .maybeSingle();

  const status = data?.subscription_status ?? "free";
  return {
    active: ACTIVE_STATUSES.has(status),
    plan: isPlanId(data?.plan) ? data.plan : null,
    status,
    renewsAt: data?.subscription_renews_at ?? null,
  };
}

/**
 * Require an active subscription and spend credits for a billable action.
 * Plan bucket drains first, then top-up (enforced in the spend_credits SQL fn).
 */
export async function requireAndSpendCredits(
  ownerId: string,
  action: BillableAction,
  refId?: string,
  quantity = 1
): Promise<CreditBalance> {
  const subscription = await getSubscriptionState(ownerId);
  if (!subscription.active) throw new SubscriptionRequiredError();

  const cost = CREDIT_COSTS[action] * Math.max(1, quantity);
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("spend_credits", {
    p_owner_id: ownerId,
    p_amount: cost,
    p_reason: action,
    p_ref_id: refId ?? null,
  });

  if (error) {
    if (error.message.includes("insufficient_credits")) {
      const balance = await getCreditBalance(ownerId);
      throw new InsufficientCreditsError(cost, balance.total);
    }
    throw new Error(`Credit spend failed: ${error.message}`);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const planCredits = row?.plan_credits ?? 0;
  const topupCredits = row?.topup_credits ?? 0;
  return { planCredits, topupCredits, total: planCredits + topupCredits };
}

/** Reset the plan bucket to the plan's monthly allotment (subscription renewal). */
export async function resetPlanCredits(ownerId: string, plan: PlanId): Promise<void> {
  const credits = PLANS[plan].creditsPerMonth;
  const admin = createSupabaseAdminClient();

  const { error: upsertErr } = await admin.from("credit_balances").upsert(
    {
      owner_id: ownerId,
      plan_credits: credits,
      cycle_started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" }
  );
  if (upsertErr) throw new Error(`Plan credit reset failed: ${upsertErr.message}`);

  const { error: ledgerErr } = await admin.from("credit_ledger").insert({
    owner_id: ownerId,
    delta: credits,
    bucket: "plan",
    reason: "plan_reset",
  });
  if (ledgerErr) throw new Error(`Ledger write failed: ${ledgerErr.message}`);
}

/** Add non-expiring top-up credits (one-off purchase). */
export async function grantTopupCredits(
  ownerId: string,
  credits: number,
  orderRefId: string
): Promise<void> {
  const admin = createSupabaseAdminClient();

  // Idempotency: skip if this order was already credited.
  const { data: existing } = await admin
    .from("credit_ledger")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("reason", "topup_purchase")
    .eq("ref_id", orderRefId)
    .maybeSingle();
  if (existing) return;

  const { data: balance } = await admin
    .from("credit_balances")
    .select("topup_credits")
    .eq("owner_id", ownerId)
    .maybeSingle();

  const { error: upsertErr } = await admin.from("credit_balances").upsert(
    {
      owner_id: ownerId,
      topup_credits: (balance?.topup_credits ?? 0) + credits,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id" }
  );
  if (upsertErr) throw new Error(`Top-up grant failed: ${upsertErr.message}`);

  const { error: ledgerErr } = await admin.from("credit_ledger").insert({
    owner_id: ownerId,
    delta: credits,
    bucket: "topup",
    reason: "topup_purchase",
    ref_id: orderRefId,
  });
  if (ledgerErr) throw new Error(`Ledger write failed: ${ledgerErr.message}`);
}

/** Enforce the plan's project-count limit before creating a new project. */
export async function assertProjectLimit(ownerId: string): Promise<void> {
  const subscription = await getSubscriptionState(ownerId);
  if (!subscription.active || !subscription.plan) throw new SubscriptionRequiredError();

  const max = PLANS[subscription.plan].maxProjects;
  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", ownerId)
    .neq("status", "archived");

  if ((count ?? 0) >= max) {
    throw new Error(
      `Your ${PLANS[subscription.plan].name} plan allows ${max} project${max === 1 ? "" : "s"}. Upgrade to add more.`
    );
  }
}
