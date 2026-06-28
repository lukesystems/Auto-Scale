import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type TrendWatchSourceRow = Database["public"]["Tables"]["trendwatch_sources"]["Row"];

export type MineableSourceRow = Pick<
  TrendWatchSourceRow,
  | "id"
  | "project_id"
  | "source_url"
  | "platform"
  | "account_type"
  | "caption"
  | "hook"
  | "angle"
  | "format"
  | "cta_pattern"
  | "visual_pattern"
  | "audience_pain"
  | "why_it_worked"
  | "how_to_adapt"
  | "fetched_text"
  | "notes"
  | "confidence_score"
  | "fetch_status"
>;
export type ProductBriefRow = Database["public"]["Tables"]["product_briefs"]["Row"];
export type ProductSiteFactRow = Database["public"]["Tables"]["product_site_facts"]["Row"];

export interface PatternMiningContext {
  projectId: string;
  brief: ProductBriefRow | null;
  facts: ProductSiteFactRow[];
  sources: MineableSourceRow[];
}

const SOURCE_SELECT =
  "id, project_id, source_url, platform, account_type, caption, hook, angle, format, cta_pattern, visual_pattern, audience_pain, why_it_worked, how_to_adapt, fetched_text, notes, confidence_score, fetch_status";

export function sourceHasMineableSignals(source: MineableSourceRow): boolean {
  return Boolean(
    source.fetched_text?.trim() ||
      source.hook?.trim() ||
      source.angle?.trim() ||
      source.format?.trim() ||
      source.cta_pattern?.trim() ||
      source.visual_pattern?.trim() ||
      source.audience_pain?.trim() ||
      source.why_it_worked?.trim() ||
      source.how_to_adapt?.trim() ||
      source.notes?.trim() ||
      source.caption?.trim()
  );
}

export async function loadPatternMiningContext(projectId: string): Promise<PatternMiningContext> {
  const supabase = createSupabaseServerClient();

  const [{ data: brief }, { data: latestCrawl }] = await Promise.all([
    supabase.from("product_briefs").select("*").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("product_site_crawls")
      .select("id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let facts: ProductSiteFactRow[] = [];
  if (latestCrawl?.id) {
    const { data } = await supabase
      .from("product_site_facts")
      .select("*")
      .eq("project_id", projectId)
      .eq("crawl_id", latestCrawl.id)
      .limit(50);
    facts = data ?? [];
  }

  const sources = await loadMineableTrendWatchSources(supabase, projectId);

  return {
    projectId,
    brief: brief ?? null,
    facts,
    sources,
  };
}

async function loadMineableTrendWatchSources(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  projectId: string
): Promise<MineableSourceRow[]> {
  const { data: sources } = await supabase
    .from("trendwatch_sources")
    .select(SOURCE_SELECT)
    .eq("project_id", projectId);

  return ((sources ?? []) as MineableSourceRow[]).filter(sourceHasMineableSignals);
}

export async function countMineableSources(projectId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  const sources = await loadMineableTrendWatchSources(supabase, projectId);

  const { count } = await supabase
    .from("video_evidence")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .or(
      "detected_hook.not.is.null,caption.not.is.null,title.not.is.null,detected_cta.not.is.null,topic_guess.not.is.null"
    );

  const videoEvidenceCount = count ?? 0;
  return Math.max(sources.length, videoEvidenceCount);
}
