import "server-only";

import { randomBytes, createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Mint a tracked short-link for a (video, account) pair. The link 302s to
 * destination_url with UTM, and every click is logged. Tracked links are
 * the only owned-side numbers we control across TikTok/IG/YT.
 */
export async function mintTrackedLink(opts: {
  projectId: string;
  growthRunId: string;
  videoId: string;
  scheduleItemId?: string | null;
  connectedAccountId?: string | null;
  destinationUrl: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
}): Promise<{ shortCode: string; trackedLinkId: string }> {
  const supabase = createSupabaseServerClient();
  // 8-char base64url (~48 bits) collision-resistant for our volumes.
  let shortCode = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    shortCode = randomBytes(6).toString("base64url").slice(0, 8);
    const { count } = await supabase
      .from("tracked_links")
      .select("id", { count: "exact", head: true })
      .eq("short_code", shortCode);
    if (!count) break;
  }

  const { data, error } = await supabase
    .from("tracked_links")
    .insert({
      project_id: opts.projectId,
      growth_run_id: opts.growthRunId,
      video_id: opts.videoId,
      schedule_item_id: opts.scheduleItemId ?? null,
      connected_account_id: opts.connectedAccountId ?? null,
      short_code: shortCode,
      destination_url: opts.destinationUrl,
      utm_source: opts.utmSource ?? null,
      utm_medium: opts.utmMedium ?? "short_form_video",
      utm_campaign: opts.utmCampaign ?? `growthrun_${opts.growthRunId.slice(0, 8)}`,
      utm_content: opts.utmContent ?? `video_${opts.videoId.slice(0, 8)}`,
      utm_term: opts.utmTerm ?? null,
    })
    .select("id, short_code")
    .single();
  if (error) throw new Error(`tracked_links insert: ${error.message}`);

  return { shortCode: data!.short_code, trackedLinkId: data!.id };
}

export function buildTrackedUrl(opts: {
  baseUrl: string;
  shortCode: string;
}): string {
  return `${opts.baseUrl.replace(/\/$/, "")}/r/${opts.shortCode}`;
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
