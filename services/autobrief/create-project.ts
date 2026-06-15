import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";
import type { SourcePlatform } from "@/lib/supabase/types";
import type { AutoBrief } from "./schema";
import type { ProviderMode } from "@/lib/provider-mode";

export interface CreateProjectFromAutoBriefInput {
  userId: string;
  brief: AutoBrief;
  providerMode: ProviderMode;
}

export interface CreateProjectFromAutoBriefResult {
  projectId: string;
}

export async function createProjectFromAutoBrief(
  input: CreateProjectFromAutoBriefInput
): Promise<CreateProjectFromAutoBriefResult> {
  const supabase = createSupabaseServerClient();
  const projectName = input.brief.product_name || "My project";

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      owner_id: input.userId,
      name: projectName,
      slug: slugify(projectName),
      niche: input.brief.niche || null,
      product_url: input.brief.product_url || null,
      description: input.brief.product_summary || null,
    })
    .select("id")
    .single();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Failed to create project.");
  }

  const competitors = input.brief.suggested_competitors.map((c) => c.name).filter(Boolean);

  await supabase.from("product_briefs").insert({
    project_id: project.id,
    product_summary: input.brief.product_summary,
    target_customer: input.brief.target_customer,
    primary_pain: input.brief.primary_pain,
    core_promise: input.brief.core_promise,
    offer: input.brief.offer ?? null,
    cta: input.brief.cta ?? null,
    competitors: competitors as never,
    content_pillars: input.brief.content_pillars as never,
    positioning_angles: input.brief.positioning_angles as never,
    production_constraints: {
      ...input.brief.production_constraints,
      preferred_platforms: [],
    } as never,
    brand_voice: input.brief.brand_voice ?? null,
  });

  if (competitors.length) {
    await supabase.from("competitors").insert(
      input.brief.suggested_competitors.map((c) => ({
        project_id: project.id,
        name: c.name,
        url: c.url ?? null,
      }))
    );
  }

  const sources = input.brief.suggested_sources.filter((s) => s.url || s.platform);
  if (sources.length) {
    await supabase.from("trendwatch_sources").insert(
      sources.map((s) => ({
        project_id: project.id,
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
        default_project_id: project.id,
      },
      { onConflict: "owner_id" }
    );

  return { projectId: project.id };
}
