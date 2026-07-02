import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { EvidenceChain } from "@/components/evidence-chain-drawer";

export async function loadVideoEvidenceChain(
  projectId: string,
  videoEvidenceId: string
): Promise<EvidenceChain> {
  const supabase = createSupabaseServerClient();
  const { data: evidence } = await supabase
    .from("video_evidence")
    .select("id, video_url, platform, title, account_handle")
    .eq("id", videoEvidenceId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!evidence) return {};

  return {
    source: {
      label: evidence.title ?? evidence.account_handle ?? "Video reference",
      detail: evidence.platform,
      href: evidence.video_url,
    },
  };
}

export async function loadTrendHopEvidenceChain(
  projectId: string,
  itemId: string
): Promise<EvidenceChain> {
  const supabase = createSupabaseServerClient();
  const { data: item } = await supabase
    .from("trendhop_items")
    .select("id, trend_name, platform, suggested_hook, promoted_video_concept_id")
    .eq("id", itemId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!item) return {};

  const chain: EvidenceChain = {
    insight: {
      label: item.trend_name,
      detail: item.platform,
    },
    hook: item.suggested_hook
      ? { label: item.suggested_hook, detail: "Suggested hook" }
      : null,
  };

  if (item.promoted_video_concept_id) {
    const { data: concept } = await supabase
      .from("video_concepts")
      .select("id, hook")
      .eq("id", item.promoted_video_concept_id)
      .maybeSingle();
    if (concept) {
      chain.concept = { label: concept.hook, detail: concept.id.slice(0, 8) };
    }
  }

  return chain;
}

export async function loadGrowthVideoEvidenceChain(
  projectId: string,
  videoId: string
): Promise<EvidenceChain> {
  const supabase = createSupabaseServerClient();
  const { data: video } = await supabase
    .from("videos")
    .select("id, concept_id, growth_run_id")
    .eq("id", videoId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!video?.concept_id) return {};

  const { data: concept } = await supabase
    .from("video_concepts")
    .select("id, hook, trendhop_item_id")
    .eq("id", video.concept_id)
    .maybeSingle();

  const chain: EvidenceChain = {
    concept: concept ? { label: concept.hook, detail: concept.id.slice(0, 8) } : null,
  };

  if (concept?.trendhop_item_id) {
    const hopChain = await loadTrendHopEvidenceChain(projectId, concept.trendhop_item_id);
    chain.insight = hopChain.insight;
    chain.hook = hopChain.hook ?? chain.hook;
  }

  const { data: experiment } = await supabase
    .from("growth_experiment_results")
    .select("id, classification")
    .eq("video_id", videoId)
    .maybeSingle();

  if (experiment) {
    chain.experiment = {
      label: experiment.classification,
      detail: experiment.id.slice(0, 8),
    };
  }

  return chain;
}
