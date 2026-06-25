import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface GrowthResultsSummary {
  videosGenerated: number;
  videosScheduled: number;
  videosPosted: number;
  totalClicks: number;
  totalSignups: number;
  demoCtaClicks: number;
  topFingerprints: Array<{ name: string; status: string; confidence: number }>;
  topHooks: Array<{ hook: string; classification: string | null }>;
  winners: Array<{ videoId: string; diagnosis: string; nextAction: string }>;
  losers: Array<{ videoId: string; diagnosis: string }>;
  compoundActions: Array<{ fingerprintName: string; action: string; status: string }>;
  recommendations: string[];
}

export async function aggregateGrowthResults(projectId: string): Promise<GrowthResultsSummary> {
  const supabase = createSupabaseServerClient();

  const [
    videosRes,
    scheduledRes,
    postedRes,
    clicksRes,
    signupsRes,
    demoClicksRes,
    fingerprintsRes,
    resultsRes,
    compoundRes,
  ] = await Promise.all([
    supabase.from("videos").select("id", { count: "exact", head: true }).eq("project_id", projectId),
    supabase
      .from("schedule_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .in("status", ["scheduled", "sending", "queued"]),
    supabase
      .from("schedule_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("status", "posted"),
    supabase
      .from("link_click_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("signup_events")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("tracked_links")
      .select("id")
      .eq("project_id", projectId)
      .eq("intent_type", "demo_intent"),
    supabase
      .from("format_fingerprints")
      .select("name, status, confidence")
      .eq("project_id", projectId)
      .order("confidence", { ascending: false })
      .limit(5),
    supabase
      .from("growth_experiment_results")
      .select("video_id, classification, diagnosis, next_action")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("format_fingerprints")
      .select("name, status, compound_action")
      .eq("project_id", projectId)
      .not("compound_action", "is", null)
      .limit(10),
  ]);

  const results = resultsRes.data ?? [];
  const winners = results
    .filter((r) => r.classification === "winner")
    .map((r) => ({
      videoId: r.video_id,
      diagnosis: r.diagnosis ?? "",
      nextAction: r.next_action,
    }));
  const losers = results
    .filter((r) => r.classification === "loser")
    .map((r) => ({
      videoId: r.video_id,
      diagnosis: r.diagnosis ?? "",
    }));

  const videoIds = results.map((r) => r.video_id);
  const { data: concepts } = videoIds.length
    ? await supabase
        .from("videos")
        .select("id, concept_id")
        .in("id", videoIds)
    : { data: [] };
  const conceptIds = (concepts ?? []).map((v) => v.concept_id).filter(Boolean);
  const { data: hooks } = conceptIds.length
    ? await supabase.from("video_concepts").select("id, hook").in("id", conceptIds)
    : { data: [] };
  const hookByConcept = new Map((hooks ?? []).map((h) => [h.id, h.hook]));
  const classByVideo = new Map(results.map((r) => [r.video_id, r.classification]));

  const topHooks = (concepts ?? [])
    .map((v) => ({
      hook: hookByConcept.get(v.concept_id) ?? "—",
      classification: classByVideo.get(v.id) ?? null,
    }))
    .slice(0, 5);

  const recommendations: string[] = [];
  if (winners.length) recommendations.push("Create variants from your latest winner.");
  if (losers.length) recommendations.push("Kill or pause weak formats to stop waste.");
  if ((scheduledRes.count ?? 0) === 0 && (videosRes.count ?? 0) > 0) {
    recommendations.push("Approve and schedule ready videos.");
  }
  if ((demoClicksRes.count ?? 0) > 0) {
    recommendations.push("Demo-intent clicks detected — scale book-demo formats.");
  }
  if (!recommendations.length) recommendations.push("Run a Growth Run and record metrics to unlock insights.");

  return {
    videosGenerated: videosRes.count ?? 0,
    videosScheduled: scheduledRes.count ?? 0,
    videosPosted: postedRes.count ?? 0,
    totalClicks: clicksRes.count ?? 0,
    totalSignups: signupsRes.count ?? 0,
    demoCtaClicks: (demoClicksRes.data ?? []).length,
    topFingerprints: (fingerprintsRes.data ?? []).map((f) => ({
      name: f.name,
      status: f.status,
      confidence: Number(f.confidence),
    })),
    topHooks,
    winners,
    losers,
    compoundActions: (compoundRes.data ?? []).map((f) => ({
      fingerprintName: f.name,
      action: f.compound_action ?? "—",
      status: f.status,
    })),
    recommendations,
  };
}
