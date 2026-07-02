"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateContentIdeas, generateHooks } from "@/services/content-conveyor/generate";
import { matchInsightForHook } from "@/lib/match-hook-insight";
import { logAIRun } from "@/services/ai/logger";

const Schema = z.object({
  project_id: z.string().uuid(),
  hook_count: z.coerce.number().int().min(3).max(60).optional(),
  idea_count: z.coerce.number().int().min(3).max(40).optional(),
});

export type GenerateIdeasResult =
  | { ok: true; hookCount: number; ideaCount: number }
  | { ok: false; error: string };

export async function generateIdeasAction(formData: FormData): Promise<GenerateIdeasResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = Schema.safeParse({
    project_id: formData.get("project_id"),
    hook_count: formData.get("hook_count") ?? undefined,
    idea_count: formData.get("idea_count") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const projectId = parsed.data.project_id;

  const [{ data: project }, { data: brief }, { data: insights }] = await Promise.all([
    supabase.from("projects").select("name, niche").eq("id", projectId).maybeSingle(),
    supabase.from("product_briefs").select("product_summary, target_customer, primary_pain, production_constraints").eq("project_id", projectId).maybeSingle(),
    supabase
      .from("trendwatch_insights")
      .select("id, insight, hook_pattern")
      .eq("project_id", projectId)
      .order("signal_score", { ascending: false })
      .limit(30),
  ]);

  if (!project) return { ok: false, error: "Project not found." };

  const preferredPlatforms = (brief?.production_constraints as { preferred_platforms?: string[] } | null)?.preferred_platforms ?? [];

  try {
    // 1. Hooks
    const hookResult = await generateHooks({
      niche: project.niche ?? undefined,
      primaryPain: brief?.primary_pain ?? undefined,
      targetCustomer: brief?.target_customer ?? undefined,
      trendwatchSummary: undefined,
      insights: (insights ?? []).map((i) => i.insight),
      hookOpportunities: (insights ?? []).filter((i) => i.hook_pattern).map((i) => i.hook_pattern!),
      count: parsed.data.hook_count ?? 24,
    });

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "hooks",
      provider: hookResult.provider,
      model: hookResult.model,
      input: { count: hookResult.hooks.length },
      rawOutput: hookResult.raw,
      parsedOutput: hookResult.hooks,
      status: "success",
      latencyMs: hookResult.latencyMs,
    });

    const insightRows = insights ?? [];

    const hookInserts = hookResult.hooks.map((h) => ({
      project_id: projectId,
      insight_id: matchInsightForHook(h.hook, insightRows),
      hook: h.hook,
      angle: h.angle || null,
      format_hint: h.format_hint || null,
      target_audience: h.target_audience || null,
    }));

    const { data: insertedHooks } = await supabase
      .from("hooks")
      .insert(hookInserts)
      .select("id, hook");

    // 2. Content ideas
    const ideaResult = await generateContentIdeas({
      niche: project.niche ?? undefined,
      productSummary: brief?.product_summary ?? undefined,
      targetCustomer: brief?.target_customer ?? undefined,
      primaryPain: brief?.primary_pain ?? undefined,
      hooks: (insertedHooks ?? []).slice(0, 12).map((h) => ({ hook: h.hook })),
      preferredPlatforms,
      count: parsed.data.idea_count ?? 12,
    });

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "content_ideas",
      provider: ideaResult.provider,
      model: ideaResult.model,
      input: { count: ideaResult.ideas.length },
      rawOutput: ideaResult.raw,
      parsedOutput: ideaResult.ideas,
      status: "success",
      latencyMs: ideaResult.latencyMs,
    });

    const ideaInserts = ideaResult.ideas.map((idea) => {
      const matchedHook = insertedHooks?.find((h) => h.hook.toLowerCase().trim() === idea.hook.toLowerCase().trim());
      return {
        project_id: projectId,
        insight_id: matchInsightForHook(idea.hook, insightRows),
        hook_id: matchedHook?.id ?? null,
        format: idea.format,
        hook: idea.hook,
        angle: idea.angle,
        target_audience: idea.target_audience,
        why_this_should_work: idea.why_this_should_work,
        hypothesis: idea.hypothesis,
        platforms: idea.platforms as never,
        metric_to_watch: idea.metric_to_watch,
        risk_level: idea.risk_level,
        variant_suggestions: idea.variant_suggestions as never,
      };
    });

    await supabase.from("content_ideas").insert(ideaInserts);

    revalidatePath(`/projects/${projectId}/ideas`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, hookCount: hookResult.hooks.length, ideaCount: ideaResult.ideas.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Idea generation failed.";
    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "content_ideas",
      provider: "unknown",
      model: "unknown",
      input: {},
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}
