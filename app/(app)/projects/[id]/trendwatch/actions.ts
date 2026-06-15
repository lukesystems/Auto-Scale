"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runTrendWatchAnalysis } from "@/services/trendwatch/generate";
import {
  aggregateRunConfidence,
  enrichSourceFromUrl,
  scoreSourceRecord,
  toTrendWatchSourceInput,
  type EnrichedSource,
  type FetchStatus,
  type SourceRecord,
} from "@/services/trendwatch/enrich-sources";
import type { DistortionRisk, SourcePlatform } from "@/lib/supabase/types";
import { logAIRun } from "@/services/ai/logger";

const RunSchema = z.object({ project_id: z.string().uuid() });

export type RunTrendWatchResult =
  | { ok: true; runId: string; insightCount: number }
  | { ok: false; error: string };

async function enrichProjectSources(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  projectId: string,
  runId: string
): Promise<EnrichedSource[]> {
  const { data: rawSources } = await supabase
    .from("trendwatch_sources")
    .select(
      "id, source_url, platform, account_handle, account_type, follower_count, views, likes, saves, shares, comments, transferability_score, notes, fetch_status, fetched_text"
    )
    .eq("project_id", projectId);

  const enriched: EnrichedSource[] = [];

  for (const row of rawSources ?? []) {
    const source = row as SourceRecord;
    const patch = await enrichSourceFromUrl(source);

    const sourceUpdate: {
      run_id: string;
      fetch_status: FetchStatus;
      fetched_text: string | null;
      fetch_metadata: Record<string, unknown>;
      signal_score: number;
      confidence_score: number;
      scoring_reasons: string[];
      distortion_risk: DistortionRisk;
      platform?: SourcePlatform;
    } = {
      run_id: runId,
      fetch_status: patch.fetch_status,
      fetched_text: patch.fetched_text,
      fetch_metadata: patch.fetch_metadata,
      signal_score: patch.signal_score,
      confidence_score: patch.confidence_score,
      scoring_reasons: patch.scoring_reasons,
      distortion_risk: patch.distortion_risk,
    };
    if (patch.platform) {
      sourceUpdate.platform = patch.platform;
    }

    await supabase.from("trendwatch_sources").update(sourceUpdate as never).eq("id", source.id);

    enriched.push({
      ...source,
      ...patch,
      fetch_metadata: patch.fetch_metadata,
      scoring_reasons: patch.scoring_reasons,
    });
  }

  return enriched;
}

export async function runTrendWatchAction(formData: FormData): Promise<RunTrendWatchResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = RunSchema.safeParse({ project_id: formData.get("project_id") });
  if (!parsed.success) return { ok: false, error: "Missing project_id." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const projectId = parsed.data.project_id;

  const [{ data: project }, { data: brief }, { data: competitors }] = await Promise.all([
    supabase.from("projects").select("name, niche").eq("id", projectId).maybeSingle(),
    supabase
      .from("product_briefs")
      .select("product_summary, target_customer, primary_pain")
      .eq("project_id", projectId)
      .maybeSingle(),
    supabase.from("competitors").select("name").eq("project_id", projectId),
  ]);

  if (!project) return { ok: false, error: "Project not found." };

  const { data: run, error: runError } = await supabase
    .from("trendwatch_runs")
    .insert({ project_id: projectId, status: "running" })
    .select("id")
    .single();
  if (runError || !run) return { ok: false, error: runError?.message ?? "Failed to create run." };

  try {
    const enrichedSources = await enrichProjectSources(supabase, projectId, run.id);
    const runConfidence = aggregateRunConfidence(enrichedSources);

    const result = await runTrendWatchAnalysis({
      projectName: project.name,
      niche: project.niche ?? undefined,
      productSummary: brief?.product_summary ?? undefined,
      targetCustomer: brief?.target_customer ?? undefined,
      primaryPain: brief?.primary_pain ?? undefined,
      competitors: (competitors ?? []).map((c) => c.name),
      sources: enrichedSources.map(toTrendWatchSourceInput),
      runConfidence,
    });

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "trendwatch_analysis",
      provider: result.provider,
      model: result.model,
      input: { project: project.name, source_count: enrichedSources.length },
      rawOutput: result.raw,
      parsedOutput: result.analysis,
      status: "success",
      latencyMs: result.latencyMs,
    });

    const insightRows: Array<{
      project_id: string;
      run_id: string;
      insight: string;
      format: string | null;
      hook_pattern: string | null;
      angle: string | null;
      signal_score: number;
      confidence_score: number;
      scoring_reasons: string[];
      recommended_experiment: string | null;
    }> = [];

    const baseConfidence = runConfidence.confidence;
    const baseReasons = runConfidence.reasons;

    for (const fmt of result.analysis.winning_formats ?? []) {
      const scored = scoreSourceRecord(
        {
          id: "synthetic",
          source_url: null,
          platform: "other",
          account_handle: null,
          account_type: "unknown",
          follower_count: null,
          views: null,
          likes: null,
          saves: null,
          shares: null,
          comments: null,
          transferability_score: 0.7,
          notes: fmt.reason,
        },
        enrichedSources.some((s) => s.fetch_status === "success"),
        enrichedSources.length === 0 ? "No sources ingested" : null
      );
      insightRows.push({
        project_id: projectId,
        run_id: run.id,
        insight: `Winning format: ${fmt.format}. ${fmt.reason}`,
        format: fmt.format,
        hook_pattern: null,
        angle: null,
        signal_score: scored.score.signalScore,
        confidence_score: Math.min(baseConfidence, scored.score.confidenceScore),
        scoring_reasons: [...baseReasons, ...scored.score.reasons],
        recommended_experiment: null,
      });
    }

    for (const hook of result.analysis.hook_opportunities ?? []) {
      const scored = scoreSourceRecord(
        {
          id: "synthetic",
          source_url: null,
          platform: "other",
          account_handle: null,
          account_type: "unknown",
          follower_count: null,
          views: null,
          likes: null,
          saves: null,
          shares: null,
          comments: null,
          transferability_score: null,
          notes: hook,
        },
        enrichedSources.some((s) => s.fetch_status === "success"),
        enrichedSources.length === 0 ? "No sources ingested" : null
      );
      insightRows.push({
        project_id: projectId,
        run_id: run.id,
        insight: `Hook opportunity: ${hook}`,
        format: null,
        hook_pattern: hook,
        angle: null,
        signal_score: scored.score.signalScore,
        confidence_score: Math.min(baseConfidence, scored.score.confidenceScore),
        scoring_reasons: [...baseReasons, ...scored.score.reasons],
        recommended_experiment: null,
      });
    }

    for (const exp of result.analysis.recommended_experiments ?? []) {
      insightRows.push({
        project_id: projectId,
        run_id: run.id,
        insight: `Recommended experiment: ${exp}`,
        format: null,
        hook_pattern: null,
        angle: null,
        signal_score: baseConfidence > 0 ? baseConfidence * 0.6 : 0.3,
        confidence_score: baseConfidence,
        scoring_reasons: baseReasons,
        recommended_experiment: exp,
      });
    }

    if (insightRows.length) {
      await supabase.from("trendwatch_insights").insert(
        insightRows.map((row) => ({
          ...row,
          scoring_reasons: row.scoring_reasons as never,
        }))
      );
    }

    const notes =
      enrichedSources.length === 0
        ? `${result.analysis.niche_summary}\n\n[LOW CONFIDENCE: No sources — output is unverified.]`
        : runConfidence.confidence < 0.5
          ? `${result.analysis.niche_summary}\n\n[LOW CONFIDENCE: ${runConfidence.reasons.join(" ")}]`
          : result.analysis.niche_summary;

    await supabase
      .from("trendwatch_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        source_count: enrichedSources.length,
        insight_count: insightRows.length,
        notes,
      })
      .eq("id", run.id);

    revalidatePath(`/projects/${projectId}/trendwatch`);
    revalidatePath(`/projects/${projectId}/sources`);
    revalidatePath(`/projects/${projectId}`);
    return { ok: true, runId: run.id, insightCount: insightRows.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "TrendWatch failed.";
    await supabase
      .from("trendwatch_runs")
      .update({ status: "failed", notes: message, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "trendwatch_analysis",
      provider: "mock",
      model: "mock-default",
      input: { project: project.name },
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}
