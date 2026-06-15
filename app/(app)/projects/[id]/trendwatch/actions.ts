"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runTrendWatchAnalysis } from "@/services/trendwatch/generate";
import { calculateSignalScore } from "@/services/trendwatch/scoring";
import { logAIRun } from "@/services/ai/logger";

const RunSchema = z.object({ project_id: z.string().uuid() });

export type RunTrendWatchResult =
  | { ok: true; runId: string; insightCount: number }
  | { ok: false; error: string };

export async function runTrendWatchAction(formData: FormData): Promise<RunTrendWatchResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = RunSchema.safeParse({ project_id: formData.get("project_id") });
  if (!parsed.success) return { ok: false, error: "Missing project_id." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const projectId = parsed.data.project_id;

  // Pull context
  const [{ data: project }, { data: brief }, { data: competitors }, { data: sources }] = await Promise.all([
    supabase.from("projects").select("name, niche").eq("id", projectId).maybeSingle(),
    supabase.from("product_briefs").select("product_summary, target_customer, primary_pain").eq("project_id", projectId).maybeSingle(),
    supabase.from("competitors").select("name").eq("project_id", projectId),
    supabase.from("trendwatch_sources").select("source_url, platform, account_handle, notes").eq("project_id", projectId).limit(30),
  ]);

  if (!project) return { ok: false, error: "Project not found." };

  // Create run record
  const { data: run, error: runError } = await supabase
    .from("trendwatch_runs")
    .insert({ project_id: projectId, status: "running" })
    .select("id")
    .single();
  if (runError || !run) return { ok: false, error: runError?.message ?? "Failed to create run." };

  try {
    const result = await runTrendWatchAnalysis({
      projectName: project.name,
      niche: project.niche ?? undefined,
      productSummary: brief?.product_summary ?? undefined,
      targetCustomer: brief?.target_customer ?? undefined,
      primaryPain: brief?.primary_pain ?? undefined,
      competitors: (competitors ?? []).map((c) => c.name),
      sources: (sources ?? []).map((s) => ({
        url: s.source_url ?? undefined,
        platform: s.platform ?? undefined,
        handle: s.account_handle ?? undefined,
        notes: s.notes ?? undefined,
      })),
    });

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "trendwatch_analysis",
      provider: result.provider,
      model: result.model,
      input: { project: project.name },
      rawOutput: result.raw,
      parsedOutput: result.analysis,
      status: "success",
      latencyMs: result.latencyMs,
    });

    // Persist insights — each "hook_opportunity" and "winning_format" becomes an insight row
    const insightRows: Array<{
      project_id: string;
      run_id: string;
      insight: string;
      format: string | null;
      hook_pattern: string | null;
      angle: string | null;
      signal_score: number;
      recommended_experiment: string | null;
    }> = [];

    for (const fmt of result.analysis.winning_formats ?? []) {
      insightRows.push({
        project_id: projectId,
        run_id: run.id,
        insight: `Winning format: ${fmt.format}. ${fmt.reason}`,
        format: fmt.format,
        hook_pattern: null,
        angle: null,
        signal_score: calculateSignalScore({
          relevance: 0.85,
          formatTransferability: 0.8,
          saveSignal: 0.7,
          recency: 0.7,
          conversionIntent: 0.6,
          accountFit: 0.7,
        }),
        recommended_experiment: null,
      });
    }
    for (const hook of result.analysis.hook_opportunities ?? []) {
      insightRows.push({
        project_id: projectId,
        run_id: run.id,
        insight: `Hook opportunity: ${hook}`,
        format: null,
        hook_pattern: hook,
        angle: null,
        signal_score: calculateSignalScore({
          relevance: 0.85,
          formatTransferability: 0.7,
          saveSignal: 0.65,
          recency: 0.7,
          conversionIntent: 0.65,
          accountFit: 0.7,
        }),
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
        signal_score: 0.6,
        recommended_experiment: exp,
      });
    }

    if (insightRows.length) {
      await supabase.from("trendwatch_insights").insert(insightRows);
    }

    await supabase
      .from("trendwatch_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        source_count: sources?.length ?? 0,
        insight_count: insightRows.length,
        notes: result.analysis.niche_summary,
      })
      .eq("id", run.id);

    revalidatePath(`/projects/${projectId}/trendwatch`);
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
