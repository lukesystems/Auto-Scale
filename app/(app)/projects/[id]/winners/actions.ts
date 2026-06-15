"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { diagnoseWinner, generateVariants } from "@/services/compound/generate";
import { logAIRun } from "@/services/ai/logger";

const Schema = z.object({
  project_id: z.string().uuid(),
  experiment_id: z.string().uuid(),
});

export type CompoundResult =
  | { ok: true; winnerId: string; variantCount: number }
  | { ok: false; error: string };

export async function compoundWinnerAction(formData: FormData): Promise<CompoundResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = Schema.safeParse({
    project_id: formData.get("project_id"),
    experiment_id: formData.get("experiment_id"),
  });
  if (!parsed.success) return { ok: false, error: "Missing data." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: experimentRaw } = await supabase
    .from("experiments")
    .select(`
      id, views, saves, shares, comments, clicks, signups, purchases, revenue, notes,
      post:generated_posts(id, hook, format, angle, target_audience, cta)
    `)
    .eq("id", parsed.data.experiment_id)
    .maybeSingle();

  const experiment = experimentRaw as {
    id: string;
    views: number | null;
    saves: number | null;
    shares: number | null;
    comments: number | null;
    clicks: number | null;
    signups: number | null;
    purchases: number | null;
    revenue: number | null;
    notes: string | null;
    post: {
      id: string;
      hook: string | null;
      format: string | null;
      angle: string | null;
      target_audience: string | null;
      cta: string | null;
    } | null;
  } | null;
  if (!experiment) return { ok: false, error: "Experiment not found." };

  const post = experiment.post as {
    id: string;
    hook: string | null;
    format: string | null;
    angle: string | null;
    target_audience: string | null;
    cta: string | null;
  } | null;

  if (!post?.hook) return { ok: false, error: "Experiment has no associated post hook." };

  try {
    // 1. Diagnose winner
    const diag = await diagnoseWinner({
      hook: post.hook,
      format: post.format ?? undefined,
      angle: post.angle ?? undefined,
      audience: post.target_audience ?? undefined,
      cta: post.cta ?? undefined,
      metrics: {
        views: experiment.views ?? undefined,
        saves: experiment.saves ?? undefined,
        shares: experiment.shares ?? undefined,
        comments: experiment.comments ?? undefined,
        clicks: experiment.clicks ?? undefined,
        signups: experiment.signups ?? undefined,
        revenue: experiment.revenue ?? undefined,
      },
      notes: experiment.notes ?? undefined,
    });

    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data.project_id,
      kind: "winner_diagnosis",
      provider: diag.provider,
      model: diag.model,
      input: { experiment_id: parsed.data.experiment_id },
      rawOutput: diag.raw,
      parsedOutput: diag.diagnosis,
      status: "success",
      latencyMs: diag.latencyMs,
    });

    const { data: winnerRow, error: winnerError } = await supabase
      .from("winners")
      .insert({
        project_id: parsed.data.project_id,
        experiment_id: parsed.data.experiment_id,
        winning_reason: diag.diagnosis.winning_reason,
        winning_elements: diag.diagnosis.winning_elements as never,
        recommended_next_actions: diag.diagnosis.recommended_next_actions as never,
        learning_to_store: diag.diagnosis.learning_to_store,
      })
      .select("id")
      .single();
    if (winnerError || !winnerRow) return { ok: false, error: winnerError?.message ?? "Failed to save winner." };

    // 2. Persist learning
    if (diag.diagnosis.learning_to_store) {
      await supabase.from("learnings").insert({
        project_id: parsed.data.project_id,
        source_winner_id: winnerRow.id,
        category: "winner",
        learning: diag.diagnosis.learning_to_store,
      });
    }

    // 3. Generate variants
    const variants = await generateVariants({
      winningHook: post.hook,
      format: post.format ?? undefined,
      angle: post.angle ?? undefined,
      audience: post.target_audience ?? undefined,
      count: 10,
    });

    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data.project_id,
      kind: "variants",
      provider: variants.provider,
      model: variants.model,
      input: { winner_id: winnerRow.id },
      rawOutput: variants.raw,
      parsedOutput: variants.variants,
      status: "success",
      latencyMs: variants.latencyMs,
    });

    if (variants.variants.length) {
      await supabase.from("variants").insert(
        variants.variants.map((v) => ({
          project_id: parsed.data.project_id,
          winner_id: winnerRow.id,
          hook: v.hook,
          angle: v.angle,
          format: v.format || post.format,
          target_audience: v.target_audience || post.target_audience,
          status: "idea",
        }))
      );
    }

    // Mark experiment as variant_created
    await supabase
      .from("experiments")
      .update({ status: "variant_created" })
      .eq("id", parsed.data.experiment_id);

    revalidatePath(`/projects/${parsed.data.project_id}/winners`);
    revalidatePath(`/projects/${parsed.data.project_id}`);
    return { ok: true, winnerId: winnerRow.id, variantCount: variants.variants.length };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compound failed.";
    return { ok: false, error: message };
  }
}
