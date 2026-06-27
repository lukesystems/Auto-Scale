"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runTrendHop } from "@/services/trendhop/run";

const ProjectIdSchema = z.string().uuid();

export type ActionResult<T = unknown> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

export async function runTrendHopAction(formData: FormData): Promise<void> {
  const parsed = ProjectIdSchema.safeParse(formData.get("projectId"));
  if (!parsed.success) return;

  await runTrendHop({ projectId: parsed.data, trigger: "manual" });
  revalidatePath(`/projects/${parsed.data}/trendwatch`);
  revalidatePath(`/projects/${parsed.data}`);
}

const ScheduleSchema = z.object({
  projectId: z.string().uuid(),
  cadenceDays: z.coerce.number().int().min(1).max(90),
  enabled: z.coerce.boolean().optional().default(true),
});

export async function upsertTrendHopScheduleAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const parsed = ScheduleSchema.safeParse({
    projectId: formData.get("projectId"),
    cadenceDays: formData.get("cadenceDays"),
    enabled: formData.get("enabled") ?? true,
  });
  if (!parsed.success) return;

  const supabase = createSupabaseServerClient();
  const next = new Date();
  next.setUTCDate(next.getUTCDate() + parsed.data.cadenceDays);

  await supabase
    .from("trendwatch_schedules")
    .upsert(
      {
        project_id: parsed.data.projectId,
        cadence_days: parsed.data.cadenceDays,
        enabled: parsed.data.enabled,
        next_run_at: next.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id" }
    );
  revalidatePath(`/projects/${parsed.data.projectId}/trendwatch`);
}

const DismissSchema = z.object({ itemId: z.string().uuid(), projectId: z.string().uuid() });

export async function dismissTrendHopAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;

  const parsed = DismissSchema.safeParse({
    itemId: formData.get("itemId"),
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) return;

  const supabase = createSupabaseServerClient();
  await supabase
    .from("trendhop_items")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", parsed.data.itemId)
    .eq("project_id", parsed.data.projectId);

  revalidatePath(`/projects/${parsed.data.projectId}/trendwatch`);
}

const SendToGrowthSchema = z.object({
  itemId: z.string().uuid(),
  projectId: z.string().uuid(),
});

/**
 * Promote a trend hop into a queued video_concept for the next Growth Run.
 */
export async function sendTrendHopToGrowthAction(formData: FormData): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const parsed = SendToGrowthSchema.safeParse({
    itemId: formData.get("itemId"),
    projectId: formData.get("projectId"),
  });
  if (!parsed.success) return;

  const supabase = createSupabaseServerClient();
  const { data: item } = await supabase
    .from("trendhop_items")
    .select("id, platform, trend_name, suggested_hook, suggested_concept, product_angle, promoted_video_concept_id")
    .eq("id", parsed.data.itemId)
    .eq("project_id", parsed.data.projectId)
    .maybeSingle();

  if (!item || item.promoted_video_concept_id) return;

  const platform = normalizePlatform(item.platform);
  const hook = item.suggested_hook?.trim() || item.trend_name || "Trend hop hook";
  const angle = item.product_angle?.trim() || item.suggested_concept?.trim() || null;

  const { data: concept, error } = await supabase
    .from("video_concepts")
    .insert({
      project_id: parsed.data.projectId,
      growth_run_id: null,
      video_type: "trend_remix",
      platform,
      target_length_seconds: 22,
      hook,
      angle,
      promise: item.suggested_concept,
      cta: null,
      hypothesis: `Trend hop: ${item.suggested_concept ?? item.product_angle ?? "organic trend remix"}`,
      trendhop_item_id: item.id,
      queued_for_next_run: true,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !concept) {
    console.warn("[trendhop] send to growth failed", error?.message);
    return;
  }

  await supabase
    .from("trendhop_items")
    .update({ promoted_video_concept_id: concept.id })
    .eq("id", parsed.data.itemId)
    .eq("project_id", parsed.data.projectId);

  revalidatePath(`/projects/${parsed.data.projectId}/trendwatch`);
  revalidatePath(`/projects/${parsed.data.projectId}/growth`);
}

function normalizePlatform(raw: string): "tiktok" | "instagram" | "youtube" {
  const p = raw.toLowerCase();
  if (p.includes("instagram") || p.includes("reels")) return "instagram";
  if (p.includes("youtube") || p.includes("short")) return "youtube";
  return "tiktok";
}
