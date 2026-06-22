"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { discoverVideoEvidence } from "@/services/intelligence/video/discover-video-evidence";
import { importManualVideoEvidence, parseManualVideoUrls } from "@/services/intelligence/video/manual-video-import";

export type VideoActionResult =
  | { ok: true; saved: number; failed?: number }
  | { ok: false; error: string };

const ProjectIdSchema = z.string().uuid();

export async function importVideoUrlsAction(formData: FormData): Promise<VideoActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const project = ProjectIdSchema.safeParse(formData.get("project_id"));
  if (!project.success) return { ok: false, error: "Invalid project." };
  const urls = parseManualVideoUrls(String(formData.get("urls") ?? ""));
  if (!urls.length) return { ok: false, error: "Add at least one public TikTok, Instagram Reels, or YouTube Shorts/profile URL." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const results = await importManualVideoEvidence({ projectId: project.data, urls });
  const saved = results.filter((result) => result.ok).length;
  const failed = results.length - saved;
  revalidatePath(`/projects/${project.data}/video-intelligence`);
  if (!saved) return { ok: false, error: results[0]?.error ?? "No video evidence could be saved." };
  return { ok: true, saved, failed };
}

export async function discoverVideoEvidenceAction(projectId: string): Promise<VideoActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };
  const project = ProjectIdSchema.safeParse(projectId);
  if (!project.success) return { ok: false, error: "Invalid project." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const result = await discoverVideoEvidence(project.data);
    revalidatePath(`/projects/${project.data}/video-intelligence`);
    if (!result.ok) return { ok: false, error: result.error ?? "No public video evidence found." };
    return { ok: true, saved: result.saved };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Video discovery failed." };
  }
}
