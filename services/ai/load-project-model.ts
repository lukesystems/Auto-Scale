import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveOpenRouterModelSlug } from "@/services/ai/model-aliases";
export async function getProjectAIModelSlug(projectId: string): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("projects")
    .select("ai_model_slug")
    .eq("id", projectId)
    .maybeSingle();
  return resolveOpenRouterModelSlug(data?.ai_model_slug ?? null);
}
