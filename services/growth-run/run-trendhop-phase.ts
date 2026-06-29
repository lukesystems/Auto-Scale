import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { discoverTrendCandidates } from "@/services/trendhop/discover";
import { generateTrendHops } from "@/services/trendhop/generate";
import { logAIRun } from "@/services/ai/logger";

type Client = SupabaseClient<Database>;

function normalizePlatform(raw: string): "tiktok" | "instagram" | "youtube" {
  const p = raw.toLowerCase();
  if (p.includes("instagram") || p.includes("reels")) return "instagram";
  if (p.includes("youtube") || p.includes("short")) return "youtube";
  return "tiktok";
}

export async function runTrendhopPhase(input: {
  projectId: string;
  growthRunId: string;
  ownerId: string;
  client: Client;
}): Promise<{ itemCount: number; conceptsQueued: number }> {
  const { data: project } = await input.client
    .from("projects")
    .select("id, niche, product_url")
    .eq("id", input.projectId)
    .maybeSingle();
  if (!project) throw new Error("Project not found.");

  const { data: brief } = await input.client
    .from("product_briefs")
    .select("product_name, product_summary, target_customer, cta, category")
    .eq("project_id", input.projectId)
    .maybeSingle();

  const { data: runRow, error: runErr } = await input.client
    .from("trendhop_runs")
    .insert({
      project_id: input.projectId,
      status: "running",
      trigger: "manual",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (runErr || !runRow) {
    throw new Error(runErr?.message ?? "Failed to create trendhop run.");
  }

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

  await logAIRun({
    ownerId: input.ownerId,
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

  let conceptsQueued = 0;

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
    const { data: inserted, error: insertErr } = await input.client
      .from("trendhop_items")
      .insert(rows)
      .select("id, platform, trend_name, suggested_hook, suggested_concept, product_angle");
    if (insertErr) throw new Error(insertErr.message);

    for (const item of inserted ?? []) {
      const platform = normalizePlatform(item.platform);
      const hook = item.suggested_hook?.trim() || item.trend_name || "Trend hop hook";
      const angle = item.product_angle?.trim() || item.suggested_concept?.trim() || null;

      const { data: concept, error: conceptErr } = await input.client
        .from("video_concepts")
        .insert({
          project_id: input.projectId,
          growth_run_id: input.growthRunId,
          video_type: "trend_remix",
          platform,
          target_length_seconds: 22,
          hook,
          angle,
          promise: item.suggested_concept,
          cta: null,
          hypothesis: `Trend hop: ${item.suggested_concept ?? item.product_angle ?? "organic trend remix"}`,
          trendhop_item_id: item.id,
          status: "draft",
        })
        .select("id")
        .single();

      if (!conceptErr && concept) {
        conceptsQueued++;
        await input.client
          .from("trendhop_items")
          .update({ promoted_video_concept_id: concept.id })
          .eq("id", item.id);
      }
    }
  }

  await input.client
    .from("trendhop_runs")
    .update({
      status: "success",
      completed_at: new Date().toISOString(),
      item_count: generated.hops.length,
    })
    .eq("id", runRow.id);

  return { itemCount: generated.hops.length, conceptsQueued };
}
