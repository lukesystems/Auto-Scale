"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AccountType, SourcePlatform } from "@/lib/supabase/types";
import { enrichSourceFromUrl, scoreSourceRecord, type SourceRecord } from "@/services/trendwatch/enrich-sources";
import { classifySource } from "@/services/trendwatch/classify-source";
import { runDiscovery } from "@/services/intelligence/discovery/run-discovery";
import { runDeepDiscovery } from "@/services/intelligence/deep-discovery";
import { promoteCandidateToSource } from "@/services/intelligence/memory/promote-candidate";
import { logAIRun } from "@/services/ai/logger";

const PlatformEnum = z.enum([
  "tiktok", "instagram", "x", "linkedin", "youtube", "threads", "pinterest", "reddit", "facebook", "other",
]);

const SourceSchema = z.object({
  project_id: z.string().uuid(),
  source_url: z.string().url().optional().or(z.literal("")),
  platform: PlatformEnum,
  account_handle: z.string().optional(),
  account_type: z.string().optional(),
  caption: z.string().max(10_000).optional(),
  published_at: z.string().optional(),
  follower_count: z.coerce.number().int().nonnegative().optional(),
  views: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  saves: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().optional(),
});

export type SourceActionResult = { ok: true } | { ok: false; error: string };

export async function addSourceAction(formData: FormData): Promise<SourceActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = SourceSchema.safeParse({
    project_id: formData.get("project_id"),
    source_url: formData.get("source_url") ?? undefined,
    platform: formData.get("platform"),
    account_handle: formData.get("account_handle") ?? undefined,
    account_type: formData.get("account_type") ?? undefined,
    caption: formData.get("caption") || undefined,
    published_at: formData.get("published_at") || undefined,
    follower_count: formData.get("follower_count") || undefined,
    views: formData.get("views") || undefined,
    likes: formData.get("likes") || undefined,
    saves: formData.get("saves") || undefined,
    shares: formData.get("shares") || undefined,
    comments: formData.get("comments") || undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: inserted, error } = await supabase
    .from("trendwatch_sources")
    .insert({
      project_id: parsed.data.project_id,
      source_url: parsed.data.source_url || null,
      platform: parsed.data.platform,
      account_handle: parsed.data.account_handle || null,
      account_type: (parsed.data.account_type as AccountType | undefined) ?? "unknown",
      caption: parsed.data.caption || null,
      published_at: parsed.data.published_at ? new Date(parsed.data.published_at).toISOString() : null,
      follower_count: parsed.data.follower_count ?? null,
      views: parsed.data.views ?? null,
      likes: parsed.data.likes ?? null,
      saves: parsed.data.saves ?? null,
      shares: parsed.data.shares ?? null,
      comments: parsed.data.comments ?? null,
      notes: parsed.data.notes || null,
      fetch_status: parsed.data.source_url ? "pending" : "skipped",
    })
    .select("id, source_url, platform, account_handle, account_type, caption, published_at, follower_count, views, likes, saves, shares, comments, transferability_score, notes")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Failed to add source." };

  const screenshot = formData.get("screenshot");
  if (screenshot instanceof File && screenshot.size > 0) {
    if (!screenshot.type.startsWith("image/") || screenshot.size > 5 * 1024 * 1024) {
      await supabase.from("trendwatch_sources").delete().eq("id", inserted.id);
      return { ok: false, error: "Screenshot must be an image no larger than 5MB." };
    }

    const extension = screenshot.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "").toLowerCase() || "png";
    const storagePath = `${user.id}/${parsed.data.project_id}/sources/${inserted.id}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from("project-assets")
      .upload(storagePath, screenshot, { contentType: screenshot.type, upsert: false });
    if (uploadError) {
      await supabase.from("trendwatch_sources").delete().eq("id", inserted.id);
      return { ok: false, error: `Screenshot upload failed: ${uploadError.message}` };
    }

    await Promise.all([
      supabase.from("trendwatch_sources").update({ screenshot_url: storagePath }).eq("id", inserted.id),
      supabase.from("assets").insert({
        project_id: parsed.data.project_id,
        owner_id: user.id,
        kind: "trendwatch_screenshot",
        storage_path: storagePath,
        mime_type: screenshot.type,
        size_bytes: screenshot.size,
        metadata: { source_id: inserted.id } as never,
      }),
    ]);
  }

  const patch = await enrichSourceFromUrl(inserted as SourceRecord);
  const classifiedSource = { ...inserted, fetched_text: patch.fetched_text } as SourceRecord;
  const classification = await classifySource(classifiedSource);
  const rescored = scoreSourceRecord(
    { ...classifiedSource, transferability_score: classification.transferability_score },
    patch.fetch_status === "success",
    typeof patch.fetch_metadata.error === "string" ? patch.fetch_metadata.error : null
  );
  await supabase
    .from("trendwatch_sources")
    .update({
      fetch_status: patch.fetch_status,
      fetched_text: patch.fetched_text,
      fetch_metadata: patch.fetch_metadata as never,
      signal_score: rescored.score.signalScore,
      confidence_score: rescored.score.confidenceScore,
      scoring_reasons: rescored.score.reasons as never,
      distortion_risk: classification.distortion_risk,
      transferability_score: classification.transferability_score,
      account_type: classification.account_type,
      format: classification.format,
      hook: classification.hook,
      angle: classification.angle,
      visual_pattern: classification.visual_pattern,
      cta_pattern: classification.cta_pattern,
      audience_pain: classification.audience_pain,
      why_it_worked: classification.why_it_worked,
      how_to_adapt: classification.how_to_adapt,
      platform: (patch.platform as SourcePlatform) ?? parsed.data.platform,
    })
    .eq("id", inserted.id);

  revalidatePath(`/projects/${parsed.data.project_id}/sources`);
  return { ok: true };
}

export async function runDiscoveryAction(projectId: string): Promise<SourceActionResult & { candidatesSaved?: number }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, error: "Invalid project." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const result = await runDiscovery({ projectId: parsed.data, enrich: true });

    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data,
      kind: "source_discovery",
      provider: result.usedFallbackPlan ? "deterministic" : "openrouter",
      model: result.usedFallbackPlan ? "fallback" : "trendwatch-routed",
      input: {
        queries: result.plan?.queries.length ?? 0,
        adaptersUsed: result.adaptersUsed,
      },
      rawOutput: result.plan ? JSON.stringify(result.plan) : undefined,
      parsedOutput: result as never,
      status: result.ok ? "success" : "failed",
      errorMessage: result.error,
    });

    revalidatePath(`/projects/${parsed.data}/sources`);

    if (!result.ok) return { ok: false, error: result.error ?? "Discovery found no candidates." };
    return { ok: true, candidatesSaved: result.candidatesSaved };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Discovery failed." };
  }
}

export async function runDeepDiscoveryAction(
  projectId: string
): Promise<SourceActionResult & { candidatesSaved?: number; rounds?: number; competitorsPromoted?: number }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = z.string().uuid().safeParse(projectId);
  if (!parsed.success) return { ok: false, error: "Invalid project." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const result = await runDeepDiscovery({ projectId: parsed.data });

    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data,
      kind: "deep_source_discovery",
      provider: result.usedFallbackSynthesis ? "deterministic" : "openrouter",
      model: result.usedFallbackSynthesis ? "fallback" : "discovery-reasoning-routed",
      input: {
        rounds: result.rounds,
        adaptersUsed: result.adaptersUsed,
        hypotheses: result.hypotheses.length,
      },
      rawOutput: result.synthesis ? JSON.stringify(result.synthesis) : undefined,
      parsedOutput: {
        candidatesFound: result.candidatesFound,
        candidatesSaved: result.candidatesSaved,
        competitorsPromoted: result.competitorsPromoted,
        competitorAccountsPromoted: result.competitorAccountsPromoted,
        trace: result.trace,
      } as never,
      status: result.ok ? "success" : "failed",
      errorMessage: result.error,
    });

    revalidatePath(`/projects/${parsed.data}/sources`);

    if (!result.ok) return { ok: false, error: result.error ?? "Deep discovery found no candidates." };
    return {
      ok: true,
      candidatesSaved: result.candidatesSaved,
      rounds: result.rounds,
      competitorsPromoted: result.competitorsPromoted,
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Deep discovery failed." };
  }
}

export async function acceptCandidateAction(input: {
  projectId: string;
  candidateId: string;
}): Promise<SourceActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const projectParsed = z.string().uuid().safeParse(input.projectId);
  const candidateParsed = z.string().uuid().safeParse(input.candidateId);
  if (!projectParsed.success || !candidateParsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    await promoteCandidateToSource({
      projectId: projectParsed.data,
      candidateId: candidateParsed.data,
    });
    revalidatePath(`/projects/${projectParsed.data}/sources`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Failed to accept candidate." };
  }
}

export async function rejectCandidateAction(input: {
  projectId: string;
  candidateId: string;
}): Promise<SourceActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const projectParsed = z.string().uuid().safeParse(input.projectId);
  const candidateParsed = z.string().uuid().safeParse(input.candidateId);
  if (!projectParsed.success || !candidateParsed.success) {
    return { ok: false, error: "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("source_candidates")
    .update({ review_status: "rejected" })
    .eq("id", candidateParsed.data)
    .eq("project_id", projectParsed.data);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectParsed.data}/sources`);
  return { ok: true };
}

export async function deleteSourceAction(formData: FormData): Promise<SourceActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const id = String(formData.get("source_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id || !projectId) return { ok: false, error: "Missing source id." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("trendwatch_sources").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${projectId}/sources`);
  return { ok: true };
}

const CompetitorSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1),
  url: z.string().url().optional().or(z.literal("")),
  notes: z.string().optional(),
});

export async function addCompetitorAction(formData: FormData): Promise<SourceActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = CompetitorSchema.safeParse({
    project_id: formData.get("project_id"),
    name: formData.get("name"),
    url: formData.get("url") ?? undefined,
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("competitors").insert({
    project_id: parsed.data.project_id,
    name: parsed.data.name,
    url: parsed.data.url || null,
    notes: parsed.data.notes || null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/projects/${parsed.data.project_id}/sources`);
  return { ok: true };
}
