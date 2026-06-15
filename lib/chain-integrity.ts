import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/types";

export interface ChainValidateParams {
  projectId: string;
  insightId?: string | null;
  ideaId?: string | null;
  postId?: string | null;
  scheduledPostId?: string | null;
  experimentId?: string | null;
  winnerId?: string | null;
  variantId?: string | null;
}

/**
 * Validates the project boundary and chain integrity server-side.
 * Ensures related entities all belong to the same project_id to prevent
 * cross-project relationships.
 */
export async function checkChainIntegrity(
  supabase: SupabaseClient<Database>,
  params: ChainValidateParams
): Promise<{ ok: boolean; error?: string }> {
  const {
    projectId,
    insightId,
    ideaId,
    postId,
    scheduledPostId,
    experimentId,
    winnerId,
    variantId,
  } = params;

  if (!projectId) {
    return { ok: false, error: "Missing project_id for integrity check." };
  }

  // 1. Verify TrendWatch Insight
  if (insightId) {
    const { data: insight } = await supabase
      .from("trendwatch_insights")
      .select("project_id")
      .eq("id", insightId)
      .maybeSingle();
    if (!insight) {
      return { ok: false, error: `Insight ${insightId} not found.` };
    }
    if (insight.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Insight belongs to a different project." };
    }
  }

  // 2. Verify Content Idea
  if (ideaId) {
    const { data: idea } = await supabase
      .from("content_ideas")
      .select("project_id, insight_id")
      .eq("id", ideaId)
      .maybeSingle();
    if (!idea) {
      return { ok: false, error: `Content idea ${ideaId} not found.` };
    }
    if (idea.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Content idea belongs to a different project." };
    }
    if (idea.insight_id && insightId && idea.insight_id !== insightId) {
      return { ok: false, error: "Chain integrity violation: Content idea is linked to a different insight." };
    }
  }

  // 3. Verify Generated Post
  if (postId) {
    const { data: post } = await supabase
      .from("generated_posts")
      .select("project_id, content_idea_id, insight_id")
      .eq("id", postId)
      .maybeSingle();
    if (!post) {
      return { ok: false, error: `Generated post ${postId} not found.` };
    }
    if (post.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Generated post belongs to a different project." };
    }
    if (post.content_idea_id && ideaId && post.content_idea_id !== ideaId) {
      return { ok: false, error: "Chain integrity violation: Post is linked to a different content idea." };
    }
    if (post.insight_id && insightId && post.insight_id !== insightId) {
      return { ok: false, error: "Chain integrity violation: Post is linked to a different insight." };
    }
  }

  // 4. Verify Scheduled Post
  if (scheduledPostId) {
    const { data: scheduled } = await supabase
      .from("scheduled_posts")
      .select("project_id, post_id")
      .eq("id", scheduledPostId)
      .maybeSingle();
    if (!scheduled) {
      return { ok: false, error: `Scheduled post ${scheduledPostId} not found.` };
    }
    if (scheduled.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Scheduled post belongs to a different project." };
    }
    if (scheduled.post_id && postId && scheduled.post_id !== postId) {
      return { ok: false, error: "Chain integrity violation: Scheduled post is linked to a different generated post." };
    }
  }

  // 5. Verify Experiment
  if (experimentId) {
    const { data: experiment } = await supabase
      .from("experiments")
      .select("project_id, post_id, scheduled_post_id")
      .eq("id", experimentId)
      .maybeSingle();
    if (!experiment) {
      return { ok: false, error: `Experiment ${experimentId} not found.` };
    }
    if (experiment.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Experiment belongs to a different project." };
    }
    if (experiment.post_id && postId && experiment.post_id !== postId) {
      return { ok: false, error: "Chain integrity violation: Experiment is linked to a different post." };
    }
    if (experiment.scheduled_post_id && scheduledPostId && experiment.scheduled_post_id !== scheduledPostId) {
      return { ok: false, error: "Chain integrity violation: Experiment is linked to a different scheduled post." };
    }
  }

  // 6. Verify Winner
  if (winnerId) {
    const { data: winner } = await supabase
      .from("winners")
      .select("project_id, experiment_id")
      .eq("id", winnerId)
      .maybeSingle();
    if (!winner) {
      return { ok: false, error: `Winner ${winnerId} not found.` };
    }
    if (winner.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Winner belongs to a different project." };
    }
    if (winner.experiment_id && experimentId && winner.experiment_id !== experimentId) {
      return { ok: false, error: "Chain integrity violation: Winner is linked to a different experiment." };
    }
  }

  // 7. Verify Variant
  if (variantId) {
    const { data: variant } = await supabase
      .from("variants")
      .select("project_id, winner_id")
      .eq("id", variantId)
      .maybeSingle();
    if (!variant) {
      return { ok: false, error: `Variant ${variantId} not found.` };
    }
    if (variant.project_id !== projectId) {
      return { ok: false, error: "Cross-project boundary violation: Variant belongs to a different project." };
    }
    if (variant.winner_id && winnerId && variant.winner_id !== winnerId) {
      return { ok: false, error: "Chain integrity violation: Variant is linked to a different winner." };
    }
  }

  return { ok: true };
}
