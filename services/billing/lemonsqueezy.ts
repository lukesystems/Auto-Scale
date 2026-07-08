import "server-only";

import type { PlanId } from "./plans";

const LS_API_URL = "https://api.lemonsqueezy.com/v1";

function apiKey(): string {
  const key = process.env.LEMONSQUEEZY_API_KEY?.trim();
  if (!key) throw new Error("LEMONSQUEEZY_API_KEY is not configured.");
  return key;
}

function storeId(): string {
  const id = process.env.LEMONSQUEEZY_STORE_ID?.trim();
  if (!id) throw new Error("LEMONSQUEEZY_STORE_ID is not configured.");
  return id;
}

/** Variant IDs come from the LS dashboard after creating products. */
export function planVariantId(plan: PlanId): string {
  const envKey = `LEMONSQUEEZY_PLAN_VARIANT_${plan.toUpperCase()}`;
  const id = process.env[envKey]?.trim();
  if (!id) throw new Error(`${envKey} is not configured.`);
  return id;
}

export function topupVariantId(pack: "small" | "medium" | "large"): string {
  const envKey = `LEMONSQUEEZY_TOPUP_VARIANT_${pack.toUpperCase()}`;
  const id = process.env[envKey]?.trim();
  if (!id) throw new Error(`${envKey} is not configured.`);
  return id;
}

export function isLemonSqueezyConfigured(): boolean {
  return Boolean(
    process.env.LEMONSQUEEZY_API_KEY?.trim() && process.env.LEMONSQUEEZY_STORE_ID?.trim()
  );
}

/**
 * Create a hosted checkout URL. `custom` data round-trips through webhooks so
 * we can attribute the purchase to a Supabase user.
 */
export async function createCheckoutUrl(input: {
  variantId: string;
  userId: string;
  userEmail?: string | null;
  redirectUrl?: string;
}): Promise<string> {
  const response = await fetch(`${LS_API_URL}/checkouts`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey()}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: input.userEmail ?? undefined,
            custom: { user_id: input.userId },
          },
          product_options: input.redirectUrl
            ? { redirect_url: input.redirectUrl }
            : undefined,
        },
        relationships: {
          store: { data: { type: "stores", id: storeId() } },
          variant: { data: { type: "variants", id: input.variantId } },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Lemon Squeezy checkout failed: HTTP ${response.status} ${body.slice(0, 300)}`);
  }

  const payload = (await response.json()) as {
    data?: { attributes?: { url?: string } };
  };
  const url = payload.data?.attributes?.url;
  if (!url) throw new Error("Lemon Squeezy returned no checkout URL.");
  return url;
}

/** Customer-portal URL for managing/cancelling a subscription. */
export async function getCustomerPortalUrl(lsSubscriptionId: string): Promise<string | null> {
  const response = await fetch(`${LS_API_URL}/subscriptions/${lsSubscriptionId}`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey()}`,
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;

  const payload = (await response.json()) as {
    data?: { attributes?: { urls?: { customer_portal?: string } } };
  };
  return payload.data?.attributes?.urls?.customer_portal ?? null;
}
