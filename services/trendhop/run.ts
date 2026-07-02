import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { logAIRun } from "@/services/ai/logger";
import { discoverTrendCandidates } from "./discover";
import { generateTrendHops } from "./generate";

export interface RunTrendHopInput {
  projectId: string;
  trigger?: "manual" | "scheduled";
}

export interface RunTrendHopResult {
  ok: boolean;
  runId: string | null;
  itemCount: number;
  error?: string;
}

/**
 * Execute one trend-hop run for a project: discover trending candidates,
 * generate hops via LLM, persist run + items. Safe to call as a server
 * action.
 */
export async function runTrendHop(input: RunTrendHopInput): Promise<RunTrendHopResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, runId: null, itemCount: 0, error: "Supabase is not configured." };
  }
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user && input.trigger !== "scheduled") {
    return { ok: false, runId: null, itemCount: 0, error: "Not signed in." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, niche, product_url")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) return { ok: false, runId: null, itemCount: 0, error: "Project not found." };

  const { data: brief } = await supabase
    .from("product_briefs")
    .select("product_name, product_summary, target_customer, cta, category")
    .eq("project_id", input.projectId)
    .maybeSingle();

  const { data: runRow, error: runErr } = await supabase
    .from("trendhop_runs")
    .insert({
      project_id: input.projectId,
      status: "running",
      trigger: input.trigger ?? "manual",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runErr || !runRow) {
    return { ok: false, runId: null, itemCount: 0, error: runErr?.message ?? "Failed to create run." };
  }

  try {
    const candidates = await discoverTrendCandidates({
      niche: project.niche ?? brief?.category ?? null,
      productCategory: brief?.category ?? null,
    });

    const generated = await generateTrendHops({
      product: {
        productName: brief?.product_name ?? null,
        productSummary: brief?.product_summary ?? null,
        targetCustomer: brief?.target_customer ?? null,
        niche: project.niche ?? brief?.category ?? null,
        cta: brief?.cta ?? null,
      },
      candidates,
    });

    if (user) {
      await logAIRun({
        ownerId: user.id,
        projectId: input.projectId,
        kind: "trendhop",
        provider: generated.provider,
        model: generated.model,
        input: { candidateCount: candidates.length },
        rawOutput: generated.raw,
        parsedOutput: { hopCount: generated.hops.length } as never,
        status: "success",
        latencyMs: generated.latencyMs,
      });
    }

    if (generated.hops.length > 0) {
      const rows = generated.hops.map((h) => ({
        run_id: runRow.id,
        project_id: input.projectId,
        platform: h.platform,
        trend_name: h.trend_name,
        why_hot: h.why_hot,
        references: h.references as unknown as never,
        product_angle: h.product_angle,
        suggested_hook: h.suggested_hook,
        suggested_concept: h.suggested_concept,
        recency_score: h.recency_score,
        confidence: h.confidence,
      }));
      const { error: insertErr } = await supabase.from("trendhop_items").insert(rows);
      if (insertErr) throw new Error(insertErr.message);
    }

    await supabase
      .from("trendhop_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        item_count: generated.hops.length,
      })
      .eq("id", runRow.id);

    return { ok: true, runId: runRow.id, itemCount: generated.hops.length };
  } catch (err) {
    const message = err instanceof Error ? err.message : "TrendHop run failed.";
    await supabase
      .from("trendhop_runs")
      .update({ status: "failed", completed_at: new Date().toISOString(), error: message })
      .eq("id", runRow.id);
    if (user) {
      await logAIRun({
        ownerId: user.id,
        projectId: input.projectId,
        kind: "trendhop",
        provider: "unknown",
        model: "unknown",
        input: { projectId: input.projectId },
        status: "failed",
        errorMessage: message,
      });
    }
    return { ok: false, runId: runRow.id, itemCount: 0, error: message };
  }
}
