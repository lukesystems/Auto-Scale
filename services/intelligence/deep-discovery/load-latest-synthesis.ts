import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketSynthesis } from "./schema";

export interface DeepDiscoverySynthesisContext {
  synthesis: MarketSynthesis | null;
  competitorNames: string[];
  handles: string[];
  platforms: string[];
}

/**
 * Load the most recent deep-discovery market synthesis for a project.
 * Used to seed video_discovery with evidence-backed handles and competitors.
 */
export async function loadLatestDeepDiscoverySynthesis(
  projectId: string
): Promise<DeepDiscoverySynthesisContext> {
  const supabase = createSupabaseServerClient();
  const { data: runs } = await supabase
    .from("source_discovery_runs")
    .select("metadata, completed_at")
    .eq("project_id", projectId)
    .order("completed_at", { ascending: false })
    .limit(8);

  for (const run of runs ?? []) {
    const meta = run.metadata as { mode?: string; synthesis?: MarketSynthesis } | null;
    if (meta?.mode !== "deep" || !meta.synthesis) continue;

    const synthesis = meta.synthesis;
    const competitorNames: string[] = [];
    const handles: string[] = [];
    const platforms: string[] = [];

    for (const profile of synthesis.competitors ?? []) {
      if (profile.name?.trim()) competitorNames.push(profile.name.trim());
      for (const handle of profile.handles ?? []) {
        const h = handle.replace(/^@/, "").trim();
        if (h) handles.push(h);
      }
      for (const platform of profile.platforms ?? []) {
        if (platform.trim()) platforms.push(platform.trim());
      }
    }

    return {
      synthesis,
      competitorNames: [...new Set(competitorNames)],
      handles: [...new Set(handles)],
      platforms: [...new Set(platforms)],
    };
  }

  return { synthesis: null, competitorNames: [], handles: [], platforms: [] };
}
