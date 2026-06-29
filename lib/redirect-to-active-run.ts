import "server-only";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Redirect legacy Foundation / TrendWatch routes to the active growth run. */
export async function redirectToActiveRun(
  projectId: string,
  hash?: string
): Promise<never> {
  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const suffix = hash ? `#${hash}` : "";
  if (run?.id) {
    redirect(`/projects/${projectId}/growth/${run.id}${suffix}`);
  }
  redirect(`/projects/${projectId}/growth`);
}
