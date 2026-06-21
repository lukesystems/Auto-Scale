"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateProductBrief } from "@/services/product-brief/generate";
import { logAIRun } from "@/services/ai/logger";
import {
  computeCompetitorConfidence,
  type BriefCompetitorEntry,
} from "@/services/intelligence/memory/merge-brief-competitors";

const BriefUpdateSchema = z.object({
  project_id: z.string().uuid(),
  source_url: z.string().optional(),
  product_name: z.string().optional(),
  one_line_description: z.string().optional(),
  category: z.string().optional(),
  product_type: z.string().optional(),
  product_summary: z.string().optional(),
  what_it_does: z.string().optional(),
  target_customer: z.string().optional(),
  target_audience: z.string().optional(),
  primary_pain: z.string().optional(),
  user_pain_points: z.string().optional(),
  core_promise: z.string().optional(),
  key_features: z.string().optional(),
  key_benefits: z.string().optional(),
  offer: z.string().optional(),
  cta: z.string().optional(),
  brand_voice: z.string().optional(),
  competitors: z.string().optional(),
  alternative_solutions: z.string().optional(),
  market_category: z.string().optional(),
  content_angles: z.string().optional(),
  platform_recommendations: z.string().optional(),
  cta_suggestions: z.string().optional(),
  founder_led_opportunities: z.string().optional(),
  positioning_gaps: z.string().optional(),
  extraction_notes: z.string().optional(),
  content_pillars: z.string().optional(), // newline-separated
  positioning_angles: z.string().optional(), // newline-separated
});

export type BriefResult = { ok: true } | { ok: false; error: string };

export async function saveBriefAction(formData: FormData): Promise<BriefResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };

  const parsed = BriefUpdateSchema.safeParse({
    project_id: formData.get("project_id"),
    source_url: formData.get("source_url") ?? undefined,
    product_name: formData.get("product_name") ?? undefined,
    one_line_description: formData.get("one_line_description") ?? undefined,
    category: formData.get("category") ?? undefined,
    product_type: formData.get("product_type") ?? undefined,
    product_summary: formData.get("product_summary") ?? undefined,
    what_it_does: formData.get("what_it_does") ?? undefined,
    target_customer: formData.get("target_customer") ?? undefined,
    target_audience: formData.get("target_audience") ?? undefined,
    primary_pain: formData.get("primary_pain") ?? undefined,
    user_pain_points: formData.get("user_pain_points") ?? undefined,
    core_promise: formData.get("core_promise") ?? undefined,
    key_features: formData.get("key_features") ?? undefined,
    key_benefits: formData.get("key_benefits") ?? undefined,
    offer: formData.get("offer") ?? undefined,
    cta: formData.get("cta") ?? undefined,
    brand_voice: formData.get("brand_voice") ?? undefined,
    competitors: formData.get("competitors") ?? undefined,
    alternative_solutions: formData.get("alternative_solutions") ?? undefined,
    market_category: formData.get("market_category") ?? undefined,
    content_angles: formData.get("content_angles") ?? undefined,
    platform_recommendations: formData.get("platform_recommendations") ?? undefined,
    cta_suggestions: formData.get("cta_suggestions") ?? undefined,
    founder_led_opportunities: formData.get("founder_led_opportunities") ?? undefined,
    positioning_gaps: formData.get("positioning_gaps") ?? undefined,
    extraction_notes: formData.get("extraction_notes") ?? undefined,
    content_pillars: formData.get("content_pillars") ?? undefined,
    positioning_angles: formData.get("positioning_angles") ?? undefined,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  const supabase = createSupabaseServerClient();

  const pillars = lines(parsed.data.content_pillars);
  const angles = lines(parsed.data.positioning_angles);
  const contentAngles = lines(parsed.data.content_angles);
  const ctaSuggestions = lines(parsed.data.cta_suggestions);
  const targetAudience = lines(parsed.data.target_audience);
  const competitors = lines(parsed.data.competitors);

  // Preserve evidence-backed (verified) competitors from deep discovery so a
  // founder edit does not silently downgrade them back to low-confidence guesses.
  const { data: existingBrief } = await supabase
    .from("product_briefs")
    .select("likely_competitors, confidence")
    .eq("project_id", parsed.data.project_id)
    .maybeSingle();

  const likelyCompetitors = mergeFounderEditedCompetitors(competitors, existingBrief?.likely_competitors);
  const competitorsConfidence = computeCompetitorConfidence(likelyCompetitors);
  const existingConfidence =
    existingBrief?.confidence && typeof existingBrief.confidence === "object" && !Array.isArray(existingBrief.confidence)
      ? (existingBrief.confidence as Record<string, unknown>)
      : {};
  const nextConfidence = { ...existingConfidence, competitors: competitorsConfidence };

  const { data: savedBrief, error } = await supabase
    .from("product_briefs")
    .upsert({
      project_id: parsed.data.project_id,
      source_url: parsed.data.source_url || null,
      product_name: parsed.data.product_name || null,
      one_line_description: parsed.data.one_line_description || null,
      category: parsed.data.category || null,
      product_type: parsed.data.product_type || null,
      product_summary: parsed.data.product_summary || null,
      what_it_does: parsed.data.what_it_does || null,
      target_customer: parsed.data.target_customer || null,
      target_audience: targetAudience as never,
      primary_pain: parsed.data.primary_pain || null,
      user_pain_points: lines(parsed.data.user_pain_points) as never,
      core_promise: parsed.data.core_promise || null,
      key_features: lines(parsed.data.key_features) as never,
      key_benefits: lines(parsed.data.key_benefits) as never,
      offer: parsed.data.offer || null,
      cta: parsed.data.cta || null,
      brand_voice: parsed.data.brand_voice || null,
      competitors: competitors as never,
      likely_competitors: likelyCompetitors as never,
      confidence: nextConfidence as never,
      alternative_solutions: lines(parsed.data.alternative_solutions) as never,
      market_category: parsed.data.market_category || null,
      content_angles: contentAngles as never,
      platform_recommendations: lines(parsed.data.platform_recommendations).map(parsePlatformRecommendation) as never,
      cta_suggestions: ctaSuggestions as never,
      founder_led_opportunities: lines(parsed.data.founder_led_opportunities) as never,
      positioning_gaps: lines(parsed.data.positioning_gaps) as never,
      extraction_notes: lines(parsed.data.extraction_notes) as never,
      content_pillars: pillars as never,
      positioning_angles: angles as never,
    }, { onConflict: "project_id" })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };

  if (savedBrief?.id) {
    await supabase
      .from("projects")
      .update({
        product_brief_id: savedBrief.id,
        status: "brief_saved",
        product_url: parsed.data.source_url || null,
        niche: parsed.data.category || null,
        description: parsed.data.one_line_description || parsed.data.product_summary || null,
      })
      .eq("id", parsed.data.project_id);
  }

  revalidatePath(`/projects/${parsed.data.project_id}`);
  return { ok: true };
}

function lines(value?: string): string[] {
  return (value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Rebuild `likely_competitors` from the founder's edited name list while keeping
 * any verified (evidence-backed) entries intact. New names the founder adds are
 * stored as unverified low-confidence guesses; verified entries the founder
 * removed are dropped.
 */
function mergeFounderEditedCompetitors(
  names: string[],
  existingLikely: unknown
): BriefCompetitorEntry[] {
  const verifiedByName = new Map<string, BriefCompetitorEntry>();
  if (Array.isArray(existingLikely)) {
    for (const item of existingLikely) {
      if (!item || typeof item !== "object" || !("name" in item)) continue;
      const entry = item as Partial<BriefCompetitorEntry> & { name?: unknown };
      const name = String(entry.name ?? "").trim();
      if (!name || entry.verification !== "verified") continue;
      verifiedByName.set(name.toLowerCase(), {
        name,
        url: entry.url ?? null,
        reason: entry.reason ?? "",
        confidence: (entry.confidence as BriefCompetitorEntry["confidence"]) ?? "medium",
        verification: "verified",
        evidence_count: typeof entry.evidence_count === "number" ? entry.evidence_count : 0,
        evidence_urls: Array.isArray(entry.evidence_urls) ? (entry.evidence_urls as string[]) : [],
        kind: entry.kind,
      });
    }
  }

  return names.map((name) => {
    const verified = verifiedByName.get(name.toLowerCase());
    if (verified) return verified;
    return {
      name,
      url: null,
      reason: "Founder edited guess",
      confidence: "low",
      verification: "unverified",
      evidence_count: 0,
      evidence_urls: [],
    };
  });
}

function parsePlatformRecommendation(value: string): { platform: string; reason: string } {
  const [platform, ...reason] = value.split(":");
  return {
    platform: platform?.trim() || "unknown",
    reason: reason.join(":").trim() || "Founder edited recommendation",
  };
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
      provider: "unknown",
      model: "unknown",
      input: { project: project.name },
      status: "failed",
      errorMessage: message,
    });
    return { ok: false, error: message };
  }
}
