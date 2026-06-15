"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateProductBrief } from "@/services/product-brief/generate";
import { logAIRun } from "@/services/ai/logger";

const BriefUpdateSchema = z.object({
  project_id: z.string().uuid(),
  product_summary: z.string().optional(),
  target_customer: z.string().optional(),
  primary_pain: z.string().optional(),
  core_promise: z.string().optional(),
  offer: z.string().optional(),
  cta: z.string().optional(),
  brand_voice: z.string().optional(),
  content_pillars: z.string().optional(), // newline-separated
  positioning_angles: z.string().optional(), // newline-separated
});

export type BriefResult = { ok: true } | { ok: false; error: string };

export async function saveBriefAction(formData: FormData): Promise<BriefResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };

  const parsed = BriefUpdateSchema.safeParse({
    project_id: formData.get("project_id"),
    product_summary: formData.get("product_summary") ?? undefined,
    target_customer: formData.get("target_customer") ?? undefined,
    primary_pain: formData.get("primary_pain") ?? undefined,
    core_promise: formData.get("core_promise") ?? undefined,
    offer: formData.get("offer") ?? undefined,
    cta: formData.get("cta") ?? undefined,
    brand_voice: formData.get("brand_voice") ?? undefined,
    content_pillars: formData.get("content_pillars") ?? undefined,
    positioning_angles: formData.get("positioning_angles") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();

  const pillars = (parsed.data.content_pillars ?? "")
    .split("\n").map((s) => s.trim()).filter(Boolean);
  const angles = (parsed.data.positioning_angles ?? "")
    .split("\n").map((s) => s.trim()).filter(Boolean);

  const { error } = await supabase
    .from("product_briefs")
    .upsert({
      project_id: parsed.data.project_id,
      product_summary: parsed.data.product_summary || null,
      target_customer: parsed.data.target_customer || null,
      primary_pain: parsed.data.primary_pain || null,
      core_promise: parsed.data.core_promise || null,
      offer: parsed.data.offer || null,
      cta: parsed.data.cta || null,
      brand_voice: parsed.data.brand_voice || null,
      content_pillars: pillars as never,
      positioning_angles: angles as never,
    }, { onConflict: "project_id" });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { ok: true };
}

const AIGenerateSchema = z.object({ project_id: z.string().uuid() });

export type GenerateBriefResult =
  | { ok: true; preview: Awaited<ReturnType<typeof generateProductBrief>>["brief"] }
  | { ok: false; error: string };

export async function aiGenerateBriefAction(formData: FormData): Promise<GenerateBriefResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };
  const parsed = AIGenerateSchema.safeParse({ project_id: formData.get("project_id") });
  if (!parsed.success) return { ok: false, error: "Missing project_id." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { data: project } = await supabase
    .from("projects")
    .select("name, niche, product_url, description")
    .eq("id", parsed.data.project_id)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };

  const { data: brief } = await supabase
    .from("product_briefs")
    .select("*")
    .eq("project_id", parsed.data.project_id)
    .maybeSingle();

  const competitorList =
    Array.isArray(brief?.competitors) ? (brief?.competitors as string[]) : [];

  try {
    const result = await generateProductBrief({
      productName: project.name,
      productUrl: project.product_url ?? undefined,
      description: project.description ?? undefined,
      targetAudience: brief?.target_customer ?? undefined,
      competitors: competitorList,
      offer: brief?.offer ?? undefined,
      cta: brief?.cta ?? undefined,
      brandTone: brief?.brand_voice ?? undefined,
    });

    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data.project_id,
      kind: "product_brief",
      provider: result.provider,
      model: result.model,
      input: { project: project.name },
      rawOutput: result.raw,
      parsedOutput: result.brief,
      status: "success",
      latencyMs: result.latencyMs,
    });

    // Merge AI-generated fields into the brief
    await supabase
      .from("product_briefs")
      .upsert({
        project_id: parsed.data.project_id,
        product_summary: result.brief.product_summary,
        target_customer: result.brief.target_customer,
        primary_pain: result.brief.primary_pain,
        core_promise: result.brief.core_promise,
        offer: result.brief.offer || brief?.offer || null,
        cta: result.brief.cta || brief?.cta || null,
        brand_voice: result.brief.brand_voice || brief?.brand_voice || null,
        content_pillars: result.brief.content_pillars as never,
        positioning_angles: result.brief.positioning_angles as never,
        production_constraints: result.brief.production_constraints as never,
      }, { onConflict: "project_id" });

    revalidatePath(`/projects/${parsed.data.project_id}`);
    return { ok: true, preview: result.brief };
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI generation failed.";
    await logAIRun({
      ownerId: user.id,
      projectId: parsed.data.project_id,
      kind: "product_brief",
      provider: "mock",
      model: "mock-default",
      input: { project: project.name },
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}
