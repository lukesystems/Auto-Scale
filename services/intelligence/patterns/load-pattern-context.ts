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
    source.source_url ||
      source.fetched_text ||
      source.hook ||
      source.angle ||
      source.format ||
      source.cta_pattern ||
      source.visual_pattern ||
      source.audience_pain ||
      source.why_it_worked ||
      source.how_to_adapt ||
      source.notes ||
      source.caption
  );
}

export async function loadPatternMiningContext(projectId: string): Promise<PatternMiningContext> {
  const supabase = createSupabaseServerClient();

  const [{ data: brief }, { data: latestCrawl }, { data: sources }] = await Promise.all([
    supabase.from("product_briefs").select("*").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("product_site_crawls")
      .select("id")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("trendwatch_sources").select(SOURCE_SELECT).eq("project_id", projectId),
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

  const mineableSources = ((sources ?? []) as MineableSourceRow[]).filter(sourceHasMineableSignals);

  return {
    projectId,
    brief: brief ?? null,
    facts,
    sources: mineableSources,
  };
}
