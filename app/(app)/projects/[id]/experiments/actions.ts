"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";
import { checkChainIntegrity } from "@/lib/chain-integrity";

const MetricsSchema = z.object({
  project_id: z.string().uuid(),
  experiment_id: z.string().uuid(),
  views: z.coerce.number().int().nonnegative().optional().nullable(),
  saves: z.coerce.number().int().nonnegative().optional().nullable(),
  shares: z.coerce.number().int().nonnegative().optional().nullable(),
  comments: z.coerce.number().int().nonnegative().optional().nullable(),
  clicks: z.coerce.number().int().nonnegative().optional().nullable(),
  signups: z.coerce.number().int().nonnegative().optional().nullable(),
  purchases: z.coerce.number().int().nonnegative().optional().nullable(),
  revenue: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(["draft","approved","exported","posted","measured","winner","neutral","loser","variant_created","killed"]).optional(),
  notes: z.string().optional(),
});

export type ExperimentResult = { ok: true } | { ok: false; error: string };

export async function updateExperimentAction(formData: FormData): Promise<ExperimentResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const raw = Object.fromEntries(formData.entries()) as Record<string, string>;
  // Replace empty strings with undefined so coerce.number().optional() works
  for (const k of Object.keys(raw)) if (raw[k] === "") delete raw[k];

  const parsed = MetricsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();

  const integrity = await checkChainIntegrity(supabase, {
    projectId: parsed.data.project_id,
    experimentId: parsed.data.experiment_id,
  });
  if (!integrity.ok) return { ok: false, error: integrity.error ?? "Chain integrity check failed." };
  const update: Database["public"]["Tables"]["experiments"]["Update"] = {
    updated_at: new Date().toISOString(),
  };
  for (const [k, v] of Object.entries(parsed.data)) {
    if (k === "project_id" || k === "experiment_id") continue;
    (update as Record<string, unknown>)[k] = v;
  }

  const { error } = await supabase
    .from("experiments")
    .update(update)
    .eq("id", parsed.data.experiment_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${parsed.data.project_id}/experiments`);
  revalidatePath(`/projects/${parsed.data.project_id}/winners`);
  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { ok: true };
}

const ManualSchema = z.object({
  project_id: z.string().uuid(),
  post_id: z.string().uuid(),
});

export async function createExperimentFromPostAction(formData: FormData): Promise<ExperimentResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const parsed = ManualSchema.safeParse({
    project_id: formData.get("project_id"),
    post_id: formData.get("post_id"),
  });
  if (!parsed.success) return { ok: false, error: "Missing post." };

  const supabase = createSupabaseServerClient();

  const integrity = await checkChainIntegrity(supabase, {
    projectId: parsed.data.project_id,
    postId: parsed.data.post_id,
  });
  if (!integrity.ok) return { ok: false, error: integrity.error ?? "Chain integrity check failed." };
  const { error } = await supabase.from("experiments").insert({
    project_id: parsed.data.project_id,
    post_id: parsed.data.post_id,
    status: "posted",
    posted_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${parsed.data.project_id}/experiments`);
  return { ok: true };
}
