"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generatePostDraft } from "@/services/content-conveyor/generate";
import { runDeterministicQualityChecks } from "@/services/quality-gate/check";
import { logAIRun } from "@/services/ai/logger";
import { validatePostForApproval } from "@/lib/approval-guard";
import { checkChainIntegrity } from "@/lib/chain-integrity";

const GenerateSchema = z.object({
  project_id: z.string().uuid(),
  idea_id: z.string().uuid(),
});

export type GeneratePostResult = { ok: true; postId: string } | { ok: false; error: string };

export async function generatePostFromIdeaAction(formData: FormData): Promise<GeneratePostResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = GenerateSchema.safeParse({
    project_id: formData.get("project_id"),
    idea_id: formData.get("idea_id"),
  });
  if (!parsed.success) return { ok: false, error: "Missing project or idea." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const projectId = parsed.data.project_id;

  const integrity = await checkChainIntegrity(supabase, {
    projectId,
    ideaId: parsed.data.idea_id,
  });
  if (!integrity.ok) return { ok: false, error: integrity.error ?? "Chain integrity check failed." };

  const [{ data: idea }, { data: project }, { data: brief }] = await Promise.all([
    supabase.from("content_ideas").select("*").eq("id", parsed.data.idea_id).maybeSingle(),
    supabase.from("projects").select("name, niche").eq("id", projectId).maybeSingle(),
    supabase.from("product_briefs").select("brand_voice, product_summary, cta").eq("project_id", projectId).maybeSingle(),
  ]);

  if (!idea || !project) return { ok: false, error: "Idea or project not found." };

  // Pre-flight: check for duplicate hooks
  const { data: existing } = await supabase
    .from("generated_posts")
    .select("hook")
    .eq("project_id", projectId);

  try {
    const result = await generatePostDraft({
      idea: {
        format: idea.format ?? "carousel",
        hook: idea.hook ?? "",
        angle: idea.angle ?? undefined,
        target_audience: idea.target_audience ?? undefined,
        hypothesis: idea.hypothesis ?? undefined,
        platforms: Array.isArray(idea.platforms) ? (idea.platforms as string[]) : undefined,
        metric_to_watch: idea.metric_to_watch ?? undefined,
      },
      niche: project.niche ?? undefined,
      brandVoice: brief?.brand_voice ?? undefined,
      cta: brief?.cta ?? undefined,
      productSummary: brief?.product_summary ?? undefined,
    });

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "generated_post",
      provider: result.provider,
      model: result.model,
      input: { idea_id: parsed.data.idea_id },
      rawOutput: result.raw,
      parsedOutput: result.post,
      status: "success",
      latencyMs: result.latencyMs,
    });

    // Determine insight linkage from idea
    const quality = runDeterministicQualityChecks({
      post: {
        format: result.post.format,
        hook: result.post.hook,
        caption: result.post.caption,
        cta: result.post.cta,
        slides: result.post.slides,
        hypothesis: result.post.hypothesis,
        metric_to_watch: result.post.metric_to_watch,
      },
      insightLinked: Boolean(idea.insight_id),
      existingHooks: (existing ?? []).map((p) => p.hook ?? "").filter(Boolean),
    });

    const { data: post, error } = await supabase
      .from("generated_posts")
      .insert({
        project_id: projectId,
        content_idea_id: parsed.data.idea_id,
        insight_id: idea.insight_id ?? null,
        format: result.post.format,
        platform: result.post.platform,
        hook: result.post.hook,
        angle: result.post.angle,
        target_audience: result.post.target_audience,
        hypothesis: result.post.hypothesis,
        caption: result.post.caption,
        cta: result.post.cta,
        metric_to_watch: result.post.metric_to_watch,
        status: quality.status === "pass" ? "in_review" : "draft",
        quality_score: quality.score,
        quality_status: quality.status,
        quality_reasons: [...quality.failure_reasons, ...quality.risk_flags] as never,
      })
      .select("id")
      .single();

    if (error || !post) return { ok: false, error: error?.message ?? "Failed to save post." };

    if (result.post.slides?.length) {
      await supabase
        .from("post_slides")
        .insert(result.post.slides.map((s) => ({
          post_id: post.id,
          slide_number: s.slide_number,
          headline: s.headline,
          body: s.body,
        })));
    }

    revalidatePath(`/projects/${projectId}/content`);
    revalidatePath(`/projects/${projectId}/approval`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, postId: post.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Post generation failed.";
    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "generated_post",
      provider: "mock",
      model: "mock-default",
      input: { idea_id: parsed.data.idea_id },
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}

const StatusSchema = z.object({
  post_id: z.string().uuid(),
  project_id: z.string().uuid(),
  status: z.enum(["draft", "in_review", "approved", "rejected", "exported", "scheduled", "posted", "archived"]),
});

export async function updatePostStatusAction(formData: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = StatusSchema.safeParse({
    post_id: formData.get("post_id"),
    project_id: formData.get("project_id"),
    status: formData.get("status"),
  });
  if (!parsed.success) return { ok: false, error: "Invalid status update." };

  const supabase = createSupabaseServerClient();

  const integrity = await checkChainIntegrity(supabase, {
    projectId: parsed.data.project_id,
    postId: parsed.data.post_id,
  });
  if (!integrity.ok) return { ok: false, error: integrity.error ?? "Chain integrity check failed." };

  if (parsed.data.status === "approved") {
    const { data: post } = await supabase
      .from("generated_posts")
      .select("quality_status, quality_score, insight_id, content_idea_id, hook, hypothesis, metric_to_watch, cta")
      .eq("id", parsed.data.post_id)
      .maybeSingle();

    if (!post) return { ok: false, error: "Post not found." };

    const approval = validatePostForApproval(post);
    if (!approval.ok) return { ok: false, error: approval.error };
  }
  const { error } = await supabase
    .from("generated_posts")
    .update({ status: parsed.data.status })
    .eq("id", parsed.data.post_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${parsed.data.project_id}/content`);
  revalidatePath(`/projects/${parsed.data.project_id}/approval`);
  return { ok: true };
}
