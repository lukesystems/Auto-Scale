import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type CrawlMode = "llm" | "heuristic";

const PREVIEW_PROJECT = "00000000-0000-0000-0000-000000000000";

export async function getCrawlModeForProject(projectId: string): Promise<CrawlMode> {
  if (!isSupabaseConfigured() || projectId === PREVIEW_PROJECT) return "llm";

  const supabase = createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.owner_id) return "llm";

  const { data: settings } = await supabase
    .from("user_settings")
    .select("crawl_mode")
    .eq("owner_id", project.owner_id)
    .maybeSingle();

  return settings?.crawl_mode === "heuristic" ? "heuristic" : "llm";
}
