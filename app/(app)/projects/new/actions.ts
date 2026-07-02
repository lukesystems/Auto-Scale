"use server";



import { redirect } from "next/navigation";

import { revalidatePath } from "next/cache";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isSupabaseConfigured } from "@/lib/supabase/env";

import { getDefaultProviderMode, getUserSettings } from "@/lib/provider-mode";

import { slugify } from "@/lib/utils";

import { createBriefGeneratingProject, createProjectFromAutoBrief } from "@/services/autobrief/create-project";

import { AutoBriefSchema } from "@/services/autobrief/schema";

import {

  parseProductUrl,

  runUrlToBriefPipeline,

} from "@/services/autobrief/run-url-to-brief-pipeline";



export type PreviewBriefFromUrlResult =

  | { ok: true; brief: z.infer<typeof AutoBriefSchema> }

  | { ok: false; error: string };



export async function previewBriefFromUrlAction(productUrl: string): Promise<PreviewBriefFromUrlResult> {

  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase is not configured." };



  const supabase = createSupabaseServerClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };



  const pipeline = await runUrlToBriefPipeline({

    userId: user.id,

    productUrl,

    profile: "preview",

  });



  if (!pipeline.ok) return { ok: false, error: pipeline.error };

  return { ok: true, brief: pipeline.brief };

}



export type CreateProjectResult =

  | { ok: true; projectId: string; fetchWarning?: string }

  | { ok: false; error: string };



export async function createProjectFromUrlAction(productUrl: string): Promise<CreateProjectResult> {

  if (!isSupabaseConfigured()) {

    return { ok: false, error: "Supabase is not configured. Add SUPABASE env vars first." };

  }



  const urlParsed = parseProductUrl(productUrl);

  if (!urlParsed.ok) return { ok: false, error: urlParsed.error };



  const supabase = createSupabaseServerClient();

  const {

    data: { user },

  } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };



  let projectId: string;

  try {

    const project = await createBriefGeneratingProject({

      userId: user.id,

      productUrl: urlParsed.url,

    });

    projectId = project.projectId;

  } catch (err) {

    return { ok: false, error: err instanceof Error ? err.message : "Failed to create project." };

  }



  const pipeline = await runUrlToBriefPipeline({

    userId: user.id,

    productUrl,

    profile: "project",

    projectId,

  });



  if (!pipeline.ok) {

    return { ok: false, error: pipeline.error };

  }



  const settings = await getUserSettings(user.id);

  const providerMode = settings?.provider_mode ?? getDefaultProviderMode();



  await createProjectFromAutoBrief({

    userId: user.id,

    projectId,

    brief: pipeline.brief,

    providerMode,

    touchUserSettings: false,

  });



  revalidatePath("/projects");

  revalidatePath(`/projects/${projectId}`);

  return { ok: true, projectId, fetchWarning: pipeline.fetchWarning };

}



const Schema = z.object({

  name: z.string().min(2, "Name is required."),

  product_url: z.string().url().optional().or(z.literal("")),

  niche: z.string().optional(),

  description: z.string().optional(),

  target_audience: z.string().optional(),

  competitors: z.string().optional(),

  offer: z.string().optional(),

  cta: z.string().optional(),

  preferred_platforms: z.array(z.string()).optional().default([]),

});



export async function createProjectAction(formData: FormData): Promise<CreateProjectResult> {

  if (!isSupabaseConfigured()) {

    return { ok: false, error: "Supabase is not configured. Add SUPABASE env vars first." };

  }



  const platforms = formData.getAll("preferred_platforms").map(String).filter(Boolean);

  const parsed = Schema.safeParse({

    name: formData.get("name"),

    product_url: formData.get("product_url"),

    niche: formData.get("niche"),

    description: formData.get("description"),

    target_audience: formData.get("target_audience"),

    competitors: formData.get("competitors"),

    offer: formData.get("offer"),

    cta: formData.get("cta"),

    preferred_platforms: platforms,

  });



  if (!parsed.success) {

    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid input." };

  }



  const supabase = createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { ok: false, error: "Not signed in." };



  const { data: project, error } = await supabase

    .from("projects")

    .insert({

      owner_id: user.id,

      name: parsed.data.name,

      slug: slugify(parsed.data.name),

      niche: parsed.data.niche || null,

      product_url: parsed.data.product_url || null,

      description: parsed.data.description || null,

      status: "brief_generating",

    })

    .select("id")

    .single();



  if (error || !project) {

    return { ok: false, error: error?.message ?? "Failed to create project." };

  }



  const competitors = (parsed.data.competitors ?? "")

    .split("\n")

    .map((c) => c.trim())

    .filter(Boolean);



  const { data: brief } = await supabase.from("product_briefs").insert({

    project_id: project.id,

    source_url: parsed.data.product_url || null,

    product_summary: parsed.data.description || null,

    one_line_description: parsed.data.description || null,

    target_customer: parsed.data.target_audience || null,

    offer: parsed.data.offer || null,

    cta: parsed.data.cta || null,

    competitors: competitors as never,

    production_constraints: {

      preferred_platforms: parsed.data.preferred_platforms,

      can_make_carousels: true,

      can_make_founder_videos: false,

      can_use_product_screenshots: true,

      can_use_ai_images: true,

    } as never,

  }).select("id").single();



  if (brief?.id) {

    await supabase

      .from("projects")

      .update({ product_brief_id: brief.id, status: "brief_saved" })

      .eq("id", project.id);

  }



  if (competitors.length) {

    await supabase

      .from("competitors")

      .insert(competitors.map((name) => ({ project_id: project.id, name })));

  }



  revalidatePath("/projects");

  return { ok: true, projectId: project.id };

}



export async function redirectToProject(projectId: string): Promise<never> {

  redirect(`/projects/${projectId}`);

}

