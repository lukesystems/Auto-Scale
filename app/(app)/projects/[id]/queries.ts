import "server-only";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export async function getProjectOr404(projectId: string) {
  if (!isSupabaseConfigured()) {
    return {
      id: projectId,
      name: "Preview project",
      niche: "Configure Supabase to load real data",
      product_url: null,
      product_brief_id: null,
      description: null,
      status: "active" as const,
      owner_id: "preview",
      slug: "preview",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("projects").select("*").eq("id", projectId).maybeSingle();
  if (!data) notFound();
  return data;
}

export async function getProductBrief(projectId: string) {
  if (!isSupabaseConfigured()) return null;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("product_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  return data;
}

export async function getProjectStats(projectId: string) {
  if (!isSupabaseConfigured()) {
    return {
      sourceCount: 0,
      insightCount: 0,
      hookCount: 0,
      ideaCount: 0,
      postCount: 0,
      approvedCount: 0,
      scheduledCount: 0,
      experimentCount: 0,
      winnerCount: 0,
      lastTrendwatch: null as string | null,
    };
  }
  const supabase = createSupabaseServerClient();
  const [sources, insights, hooks, ideas, posts, approved, scheduled, experiments, winners, lastRun] =
    await Promise.all([
      supabase.from("trendwatch_sources").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("trendwatch_insights").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("hooks").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("content_ideas").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("generated_posts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase
        .from("generated_posts")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .eq("status", "approved"),
      supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("experiments").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase.from("winners").select("id", { count: "exact", head: true }).eq("project_id", projectId),
      supabase
        .from("trendwatch_runs")
        .select("created_at, completed_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  return {
    sourceCount: sources.count ?? 0,
    insightCount: insights.count ?? 0,
    hookCount: hooks.count ?? 0,
    ideaCount: ideas.count ?? 0,
    postCount: posts.count ?? 0,
    approvedCount: approved.count ?? 0,
    scheduledCount: scheduled.count ?? 0,
    experimentCount: experiments.count ?? 0,
    winnerCount: winners.count ?? 0,
    lastTrendwatch: lastRun.data?.completed_at ?? lastRun.data?.created_at ?? null,
  };
}
