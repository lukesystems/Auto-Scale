"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { AccountType, SourcePlatform } from "@/lib/supabase/types";
import { enrichSourceFromUrl, type SourceRecord } from "@/services/trendwatch/enrich-sources";

const PlatformEnum = z.enum([
  "tiktok", "instagram", "x", "linkedin", "youtube", "threads", "pinterest", "reddit", "facebook", "other",
]);

const SourceSchema = z.object({
  project_id: z.string().uuid(),
  source_url: z.string().url().optional().or(z.literal("")),
  platform: PlatformEnum,
  account_handle: z.string().optional(),
  account_type: z.string().optional(),
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
    notes: formData.get("notes") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();
  const { data: inserted, error } = await supabase
    .from("trendwatch_sources")
    .insert({
      project_id: parsed.data.project_id,
      source_url: parsed.data.source_url || null,
      platform: parsed.data.platform,
      account_handle: parsed.data.account_handle || null,
      account_type: (parsed.data.account_type as AccountType | undefined) ?? "unknown",
      notes: parsed.data.notes || null,
      fetch_status: parsed.data.source_url ? "pending" : "skipped",
    })
    .select("id, source_url, platform, account_handle, account_type, follower_count, views, likes, saves, shares, comments, transferability_score, notes")
    .single();
  if (error || !inserted) return { ok: false, error: error?.message ?? "Failed to add source." };

  if (parsed.data.source_url) {
    const patch = await enrichSourceFromUrl(inserted as SourceRecord);
    await supabase
      .from("trendwatch_sources")
      .update({
        fetch_status: patch.fetch_status,
        fetched_text: patch.fetched_text,
        fetch_metadata: patch.fetch_metadata as never,
        signal_score: patch.signal_score,
        confidence_score: patch.confidence_score,
        scoring_reasons: patch.scoring_reasons as never,
        distortion_risk: patch.distortion_risk,
        platform: (patch.platform as SourcePlatform) ?? parsed.data.platform,
      })
      .eq("id", inserted.id);
  }

  revalidatePath(`/projects/${parsed.data.project_id}/sources`);
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
