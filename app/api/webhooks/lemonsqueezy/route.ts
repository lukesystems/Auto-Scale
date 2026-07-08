import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { grantTopupCredits, resetPlanCredits } from "@/services/billing/credits";
import { TOPUP_PACKS, isPlanId, type PlanId } from "@/services/billing/plans";

export const runtime = "nodejs";

interface LsWebhookPayload {
  meta?: {
    event_name?: string;
    custom_data?: { user_id?: string };
  };
  data?: {
    id?: string;
    attributes?: {
      customer_id?: number;
      status?: string;
      renews_at?: string | null;
      ends_at?: string | null;
      variant_id?: number;
      first_order_item?: { variant_id?: number };
      total?: number;
    };
  };
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET?.trim();
  if (!secret || !signature) return false;

  const digest = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

function planFromVariantId(variantId: number | undefined): PlanId | null {
  if (!variantId) return null;
  for (const plan of ["launch", "growth", "operator"] as const) {
    const envValue = process.env[`LEMONSQUEEZY_PLAN_VARIANT_${plan.toUpperCase()}`]?.trim();
    if (envValue && String(variantId) === envValue) return plan;
  }
  return null;
}

function topupCreditsFromVariantId(variantId: number | undefined): number | null {
  if (!variantId) return null;
  for (const pack of TOPUP_PACKS) {
    const envValue = process.env[`LEMONSQUEEZY_TOPUP_VARIANT_${pack.key.toUpperCase()}`]?.trim();
    if (envValue && String(variantId) === envValue) return pack.credits;
  }
  return null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: LsWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as LsWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name;
  const userId = payload.meta?.custom_data?.user_id;
  const attributes = payload.data?.attributes;

  if (!eventName) return NextResponse.json({ error: "Missing event name" }, { status: 400 });
  if (!userId) {
    // Purchases made outside the app (no custom user_id) can't be attributed.
    console.warn("[ls-webhook] event without user_id custom data:", eventName);
    return NextResponse.json({ ok: true, skipped: "no user_id" });
  }

  const admin = createSupabaseAdminClient();

  try {
    switch (eventName) {
      case "subscription_created":
      case "subscription_updated":
      case "subscription_resumed":
      case "subscription_unpaused": {
        const plan = planFromVariantId(attributes?.variant_id);
        const status = attributes?.status ?? "active";

        await admin
          .from("profiles")
          .update({
            ...(plan ? { plan } : {}),
            subscription_status: status,
            ls_customer_id: attributes?.customer_id ? String(attributes.customer_id) : undefined,
            ls_subscription_id: payload.data?.id ?? undefined,
            subscription_renews_at: attributes?.renews_at ?? null,
            subscription_ends_at: attributes?.ends_at ?? null,
          })
          .eq("id", userId);

        // First activation grants the initial plan bucket.
        if (eventName === "subscription_created" && plan) {
          await resetPlanCredits(userId, plan);
        }
        break;
      }

      case "subscription_payment_success": {
        // Renewal invoice paid → reset the monthly plan bucket.
        const { data: profile } = await admin
          .from("profiles")
          .select("plan")
          .eq("id", userId)
          .maybeSingle();
        if (isPlanId(profile?.plan)) {
          await resetPlanCredits(userId, profile.plan);
        }
        break;
      }

      case "subscription_cancelled":
      case "subscription_expired":
      case "subscription_paused": {
        await admin
          .from("profiles")
          .update({
            subscription_status: eventName === "subscription_expired" ? "expired" : "cancelled",
            subscription_ends_at: attributes?.ends_at ?? null,
          })
          .eq("id", userId);
        break;
      }

      case "order_created": {
        // Top-up purchases are one-off orders; subscriptions also emit
        // order_created, so only credit when the variant is a top-up pack.
        const variantId = attributes?.first_order_item?.variant_id;
        const credits = topupCreditsFromVariantId(variantId);
        if (credits && payload.data?.id) {
          await grantTopupCredits(userId, credits, payload.data.id);
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    console.error("[ls-webhook] handler failed:", eventName, err);
    // 500 → Lemon Squeezy retries the delivery.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
