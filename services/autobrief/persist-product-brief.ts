import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { AutoBrief } from "./schema";

export async function persistAutoBriefForProject(
  projectId: string,
  brief: AutoBrief
): Promise<string> {
  const supabase = createSupabaseServerClient();
  const projectName = brief.product_name || "My project";
  const competitors = brief.suggested_competitors.map((c) => c.name).filter(Boolean);

  const { data: savedBrief, error: briefError } = await supabase
    .from("product_briefs")
    .upsert(
      {
        project_id: projectId,
        source_url: brief.product_url || null,
        product_name: brief.product_name || null,
        one_line_description: brief.one_line_description || brief.product_summary || null,
        category: brief.category || brief.niche || null,
        product_type: brief.product_type || null,
        product_summary: brief.product_summary,
        what_it_does: brief.what_it_does || null,
        target_customer: brief.target_customer,
        target_audience: (brief.target_audience.length
          ? brief.target_audience
          : [brief.target_customer].filter(Boolean)) as never,
        primary_pain: brief.primary_pain,
        user_pain_points: brief.user_pain_points as never,
        core_promise: brief.core_promise,
        key_features: brief.key_features as never,
        key_benefits: brief.key_benefits as never,
        offer: brief.offer ?? null,
        cta: brief.cta ?? null,
        competitors: competitors as never,
        likely_competitors: brief.suggested_competitors as never,
        alternative_solutions: brief.alternative_solutions as never,
        market_category: brief.market_category || brief.category || null,
        content_pillars: brief.content_pillars as never,
        positioning_angles: brief.positioning_angles as never,
        content_angles: brief.content_angles as never,
        platform_recommendations: brief.platform_recommendations as never,
        cta_suggestions: brief.cta_suggestions as never,
        founder_led_opportunities: brief.founder_led_opportunities as never,
        positioning_gaps: brief.positioning_gaps as never,
        confidence: brief.confidence as never,
        extraction_notes: brief.extraction_notes as never,
        production_constraints: {
          ...brief.production_constraints,
        } as never,
        brand_voice: brief.brand_voice ?? null,
      },
      { onConflict: "project_id" }
    )
    .select("id")
    .single();

  if (briefError || !savedBrief) {
    throw new Error(briefError?.message ?? "Failed to save product brief.");
  }

  await supabase
    .from("projects")
    .update({
      name: projectName,
      slug: slugify(projectName),
      niche: brief.niche || brief.category || null,
      product_url: brief.product_url || null,
      product_brief_id: savedBrief.id,
      description: brief.one_line_description || brief.product_summary || null,
      status: "brief_saved",
    })
    .eq("id", projectId);

  return savedBrief.id;
}
