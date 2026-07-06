import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface DailyGrowthPackItem {
  item_type: string;
  title: string;
  body: string | null;
  reference_id: string | null;
  reference_type: string | null;
  priority: number;
  metadata: Record<string, unknown>;
}

export interface DailyGrowthPackResult {
  packId: string;
  packDate: string;
  postingRecommendation: string;
  items: DailyGrowthPackItem[];
}

/**
 * Build today's operating surface from latest run data, fingerprints,
 * experiment results, and account capacity.
 */
export async function generateDailyGrowthPack(projectId: string): Promise<DailyGrowthPackResult> {
  const supabase = createSupabaseServerClient();
  const packDate = new Date().toISOString().slice(0, 10);

  const { data: latestRun } = await supabase
    .from("growth_runs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const [
    { data: readyVideos },
    { data: queuedVideos },
    { data: trend },
    { data: fingerprints },
    { data: results },
    { data: killed },
    { data: accounts },
  ] = await Promise.all([
    supabase
      .from("videos")
      .select("id, concept_id, status")
      .eq("project_id", projectId)
      .eq("status", "ready")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("videos")
      .select("id, concept_id, status")
      .eq("project_id", projectId)
      .in("status", ["approved", "rendering"])
      .order("created_at", { ascending: false })
      .limit(3),
    latestRun?.id
      ? supabase
          .from("video_trend_reports")
          .select("hook_patterns, confidence")
          .eq("growth_run_id", latestRun.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("format_fingerprints")
      .select("id, name, status, compound_action, confidence")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(10),
    supabase
      .from("growth_experiment_results")
      .select("id, video_id, classification, next_action")
      .eq("project_id", projectId)
      .eq("classification", "winner")
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("format_fingerprints")
      .select("id, name, paused_until")
      .eq("project_id", projectId)
      .in("status", ["killed"])
      .limit(3),
    supabase
      .from("connected_accounts")
      .select("id, platform, handle, status, max_posts_per_day")
      .eq("project_id", projectId)
      .eq("status", "active"),
  ]);

  const items: DailyGrowthPackItem[] = [];
  let priority = 100;

  for (const v of readyVideos ?? []) {
    const { data: concept } = await supabase
      .from("video_concepts")
      .select("hook, platform")
      .eq("id", v.concept_id)
      .maybeSingle();
    items.push({
      item_type: "ready_video",
      title: concept?.hook?.slice(0, 80) ?? "Ready video",
      body: `Platform: ${concept?.platform ?? "unknown"} — status ready`,
      reference_id: v.id,
      reference_type: "videos",
      priority: priority--,
      metadata: {},
    });
    if (items.filter((i) => i.item_type === "ready_video").length >= 3) break;
  }

  for (const v of queuedVideos ?? []) {
    if (items.filter((i) => i.item_type === "queued_video").length >= 2) break;
    const { data: concept } = await supabase
      .from("video_concepts")
      .select("hook")
      .eq("id", v.concept_id)
      .maybeSingle();
    items.push({
      item_type: "queued_video",
      title: concept?.hook?.slice(0, 80) ?? "Queued video",
      body: `Status: ${v.status}`,
      reference_id: v.id,
      reference_type: "videos",
      priority: priority--,
      metadata: {},
    });
  }

  const hooks = Array.isArray(trend?.hook_patterns) ? trend.hook_patterns : [];
  for (const h of hooks.slice(0, 2)) {
    const row = h as { label?: string; pattern?: string };
    items.push({
      item_type: "trend_hook",
      title: row.label ?? "Trend hook",
      body: row.pattern ?? null,
      reference_id: latestRun?.id ?? null,
      reference_type: "growth_runs",
      priority: priority--,
      metadata: { confidence: trend?.confidence ?? null },
    });
  }

  for (const w of results ?? []) {
    items.push({
      item_type: "winner_variant",
      title: "Scale this winner",
      body: `Next action from compound: ${w.next_action}`,
      reference_id: w.video_id,
      reference_type: "videos",
      priority: priority--,
      metadata: { result_id: w.id },
    });
    break;
  }

  const testingFingerprint = (fingerprints ?? []).find((f) => f.status === "testing");
  if (testingFingerprint) {
    items.push({
      item_type: "pattern_to_test",
      title: testingFingerprint.name,
      body: `Format fingerprint in testing (confidence ${testingFingerprint.confidence})`,
      reference_id: testingFingerprint.id,
      reference_type: "format_fingerprints",
      priority: priority--,
      metadata: {},
    });
  }

  const weakFormat = (killed ?? [])[0] ?? (fingerprints ?? []).find((f) => f.status === "killed");
  if (weakFormat) {
    items.push({
      item_type: "format_to_avoid",
      title: weakFormat.name,
      body: "Paused after kill decision — do not produce more until window expires.",
      reference_id: weakFormat.id,
      reference_type: "format_fingerprints",
      priority: priority--,
      metadata: { paused_until: (weakFormat as { paused_until?: string }).paused_until ?? null },
    });
  }

  const capacity = (accounts ?? []).reduce((s, a) => s + (a.max_posts_per_day ?? 0), 0);
  const postingRecommendation =
    capacity > 0
      ? `Post up to ${capacity} video(s) today across ${accounts!.length} active account(s). Prioritize ready videos with quality scores ≥ 0.55.`
      : "No connected accounts — connect Post Bridge accounts in Settings.";

  items.push({
    item_type: "posting_recommendation",
    title: "Today's posting plan",
    body: postingRecommendation,
    reference_id: null,
    reference_type: null,
    priority: 1,
    metadata: { account_count: accounts?.length ?? 0, daily_capacity: capacity },
  });

  const { data: pack, error } = await supabase
    .from("daily_growth_packs")
    .upsert(
      {
        project_id: projectId,
        pack_date: packDate,
        posting_recommendation: postingRecommendation,
        metadata: { source_run_id: latestRun?.id ?? null } as never,
        generated_at: new Date().toISOString(),
      } as never,
      { onConflict: "project_id,pack_date" }
    )
    .select("id")
    .single();
  if (error) throw new Error(`daily_growth_packs upsert: ${error.message}`);

  await supabase.from("daily_growth_pack_items").delete().eq("pack_id", pack!.id);
  if (items.length) {
    await supabase.from("daily_growth_pack_items").insert(
      items.map((item) => ({
        pack_id: pack!.id,
        item_type: item.item_type,
        title: item.title,
        body: item.body,
        reference_id: item.reference_id,
        reference_type: item.reference_type,
        priority: item.priority,
        metadata: item.metadata as never,
      })) as never
    );
  }

  return {
    packId: pack!.id,
    packDate,
    postingRecommendation,
    items,
  };
}
