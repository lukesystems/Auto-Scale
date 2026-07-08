"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createCheckoutUrl,
  getCustomerPortalUrl,
  isLemonSqueezyConfigured,
  planVariantId,
  topupVariantId,
} from "./lemonsqueezy";
import { getCreditBalance, getSubscriptionState } from "./credits";
import { isPlanId } from "./plans";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://autoscaleshorts.com";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string };

export async function createPlanCheckoutAction(plan: string): Promise<CheckoutResult> {
  if (!isPlanId(plan)) return { ok: false, error: "Unknown plan." };
  if (!isLemonSqueezyConfigured()) {
    return { ok: false, error: "Billing is not configured yet. Contact support@autoscaleshorts.com." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  try {
    const url = await createCheckoutUrl({
      variantId: planVariantId(plan),
      userId: user.id,
      userEmail: user.email,
      redirectUrl: `${APP_URL}/settings/billing?checkout=success`,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Checkout failed." };
  }
}

export async function createTopupCheckoutAction(
  pack: "small" | "medium" | "large"
): Promise<CheckoutResult> {
  if (!isLemonSqueezyConfigured()) {
    return { ok: false, error: "Billing is not configured yet. Contact support@autoscaleshorts.com." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in first." };

  try {
    const url = await createCheckoutUrl({
      variantId: topupVariantId(pack),
      userId: user.id,
      userEmail: user.email,
      redirectUrl: `${APP_URL}/settings/billing?topup=success`,
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Checkout failed." };
  }
}

export interface BillingOverview {
  planCredits: number;
  topupCredits: number;
  totalCredits: number;
  plan: string | null;
  status: string;
  active: boolean;
  renewsAt: string | null;
  portalUrl: string | null;
}

export async function getBillingOverviewAction(): Promise<BillingOverview | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [balance, subscription] = await Promise.all([
    getCreditBalance(user.id),
    getSubscriptionState(user.id),
  ]);

  let portalUrl: string | null = null;
  if (subscription.active && isLemonSqueezyConfigured()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("ls_subscription_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.ls_subscription_id) {
      portalUrl = await getCustomerPortalUrl(profile.ls_subscription_id).catch(() => null);
    }
  }

  return {
    planCredits: balance.planCredits,
    topupCredits: balance.topupCredits,
    totalCredits: balance.total,
    plan: subscription.plan,
    status: subscription.status,
    active: subscription.active,
    renewsAt: subscription.renewsAt,
    portalUrl,
  };
}
