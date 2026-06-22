import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { hashIp } from "@/services/tracking/links";

/**
 * GET /r/[code]
 *
 * Tracked-link redirect. 302s to destination_url with UTM appended, then
 * logs the click into link_click_events and increments tracked_links.click_count.
 * This is the only fully-owned attribution surface AutoScale has against
 * TikTok/IG/YT — keep it fast and resilient.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = params.code;
  if (!code || code.length > 32) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const admin = createSupabaseAdminClient();
  const { data: link } = await admin
    .from("tracked_links")
    .select(
      "id, project_id, destination_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term, click_count"
    )
    .eq("short_code", code)
    .maybeSingle();

  if (!link) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  let destination: URL;
  try {
    destination = new URL(link.destination_url);
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const setParam = (k: string, v: string | null | undefined) => {
    if (!v) return;
    if (!destination.searchParams.has(k)) destination.searchParams.set(k, v);
  };
  setParam("utm_source", link.utm_source);
  setParam("utm_medium", link.utm_medium);
  setParam("utm_campaign", link.utm_campaign);
  setParam("utm_content", link.utm_content);
  setParam("utm_term", link.utm_term);
  setParam("autoscale_link", link.id);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    null;

  // Fire-and-forget logging — don't block the redirect.
  void admin
    .from("link_click_events")
    .insert({
      tracked_link_id: link.id,
      project_id: link.project_id,
      user_agent: req.headers.get("user-agent"),
      referrer: req.headers.get("referer"),
      ip_hash: hashIp(ip),
    })
    .then(() =>
      admin
        .from("tracked_links")
        .update({ click_count: (link.click_count ?? 0) + 1 })
        .eq("id", link.id)
    );

  return NextResponse.redirect(destination.toString(), 302);
}
