import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { SourcePlatform } from "@/lib/supabase/types";
import type { AutoBrief } from "./schema";
import type { ProviderMode } from "@/lib/provider-mode";

export interface CreateProjectFromAutoBriefInput {
  userId: string;
  brief: AutoBrief;
  providerMode: ProviderMode;
  projectId?: string;
}

export interface CreateProjectFromAutoBriefResult {
  projectId: string;
  productBriefId: string;
}

export async function createBriefGeneratingProject(input: {
  userId: string;
  productUrl: string;
  productName?: string | null;
}): Promise<CreateProjectFromAutoBriefResult> {
  const supabase = createSupabaseServerClient();
  const name = input.productName?.trim() || projectNameFromUrl(input.productUrl);

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      owner_id: input.userId,
      name,
      slug: slugify(name),
      product_url: input.productUrl,
      status: "brief_generating",
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error(error?.message ?? "Failed to create project.");
  }

  return { projectId: project.id, productBriefId: "" };
}

export async function createProjectFromAutoBrief(
  input: CreateProjectFromAutoBriefInput
): Promise<CreateProjectFromAutoBriefResult> {
  const supabase = createSupabaseServerClient();
  const projectName = input.brief.product_name || "My project";
  const projectId = input.projectId ?? (await createBriefGeneratingProject({
    userId: input.userId,
    productUrl: input.brief.product_url,
    productName: projectName,
  })).projectId;

  const competitors = input.brief.suggested_competitors.map((c) => c.name).filter(Boolean);

  const { data: savedBrief, error: briefError } = await supabase.from("product_briefs").upsert({
    project_id: projectId,
    source_url: input.brief.product_url || null,
    product_name: input.brief.product_name || null,
    one_line_description: input.brief.one_line_description || input.brief.product_summary || null,
    category: input.brief.category || input.brief.niche || null,
    product_type: input.brief.product_type || null,
    product_summary: input.brief.product_summary,
    what_it_does: input.brief.what_it_does || null,
    target_customer: input.brief.target_customer,
    target_audience: (input.brief.target_audience.length ? input.brief.target_audience : [input.brief.target_customer].filter(Boolean)) as never,
    primary_pain: input.brief.primary_pain,
    user_pain_points: input.brief.user_pain_points as never,
    core_promise: input.brief.core_promise,
    key_features: input.brief.key_features as never,
    key_benefits: input.brief.key_benefits as never,
    offer: input.brief.offer ?? null,
    cta: input.brief.cta ?? null,
    competitors: competitors as never,
    likely_competitors: input.brief.suggested_competitors as never,
    alternative_solutions: input.brief.alternative_solutions as never,
    market_category: input.brief.market_category || input.brief.category || null,
    content_pillars: input.brief.content_pillars as never,
    positioning_angles: input.brief.positioning_angles as never,
    content_angles: input.brief.content_angles as never,
    platform_recommendations: input.brief.platform_recommendations as never,
    cta_suggestions: input.brief.cta_suggestions as never,
    founder_led_opportunities: input.brief.founder_led_opportunities as never,
    positioning_gaps: input.brief.positioning_gaps as never,
    confidence: input.brief.confidence as never,
    extraction_notes: input.brief.extraction_notes as never,
    production_constraints: {
      ...input.brief.production_constraints,
      preferred_platforms: [],
    } as never,
    brand_voice: input.brief.brand_voice ?? null,
  }, { onConflict: "project_id" }).select("id").single();

  if (briefError || !savedBrief) {
    throw new Error(briefError?.message ?? "Failed to save product brief.");
  }

  await supabase
    .from("projects")
    .update({
      name: projectName,
      slug: slugify(projectName),
      niche: input.brief.niche || input.brief.category || null,
      product_url: input.brief.product_url || null,
      product_brief_id: savedBrief.id,
      description: input.brief.one_line_description || input.brief.product_summary || null,
      status: "brief_saved",
    })
    .eq("id", projectId);

  if (competitors.length) {
    await supabase.from("competitors").insert(
      input.brief.suggested_competitors.map((c) => ({
        project_id: projectId,
        name: c.name,
        url: c.url ?? null,
      }))
    );
  }

  const sources = input.brief.suggested_sources.filter((s) => s.url || s.platform);
  if (sources.length) {
    await supabase.from("trendwatch_sources").insert(
      sources.map((s) => ({
        project_id: projectId,
        source_url: s.url ?? null,
        platform: (s.platform ?? "other") as SourcePlatform,
        notes: s.reason,
        fetch_status: "pending",
      }))
    );
  }

  await supabase
    .from("user_settings")
    .upsert(
      {
        owner_id: input.userId,
        provider_mode: input.providerMode,
        onboarding_completed: true,
        default_project_id: projectId,
      },
      { onConflict: "owner_id" }
    );

  return { projectId, productBriefId: savedBrief.id };
}

function projectNameFromUrl(productUrl: string): string {
  try {
    const url = new URL(productUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Untitled project";
  }
}
