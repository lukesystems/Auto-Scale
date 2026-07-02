import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { ingestMetricsForProject } from "./run-ingestion";
import type { IngestionRunSummary } from "./types";

export interface MetricsIngestionCronSummary {
  projects: number;
  results: IngestionRunSummary[];
  totalIngested: number;
  totalSkipped: number;
  errors: string[];
}

/**
 * Daily metrics pull for all projects with recently posted schedule items.
 * Intended for an external scheduler hitting /api/cron/metrics-ingestion.
 */
export async function runDueMetricsIngestion(opts?: {
  sinceDays?: number;
}): Promise<MetricsIngestionCronSummary> {
  const admin = createSupabaseAdminClient();
  const sinceIso = new Date();
  sinceIso.setDate(sinceIso.getDate() - (opts?.sinceDays ?? 30));

  const { data: scheduleRows, error } = await admin
    .from("schedule_items")
    .select("project_id")
    .eq("status", "posted")
    .not("postiz_post_id", "is", null)
    .or(`posted_at.gte.${sinceIso.toISOString()},and(posted_at.is.null,scheduled_for.gte.${sinceIso.toISOString()})`);

  if (error) {
    return {
      projects: 0,
      results: [],
      totalIngested: 0,
      totalSkipped: 0,
      errors: [error.message],
    };
  }

  const projectIds = [...new Set((scheduleRows ?? []).map((row) => row.project_id))];
  const results: IngestionRunSummary[] = [];
  let totalIngested = 0;
  let totalSkipped = 0;
  const errors: string[] = [];

  for (const projectId of projectIds) {
    const { data: project } = await admin
      .from("projects")
      .select("owner_id")
      .eq("id", projectId)
      .maybeSingle();

    const summary = await ingestMetricsForProject(projectId, {
      sinceDays: opts?.sinceDays ?? 30,
      ownerId: project?.owner_id,
    });
    results.push(summary);
    totalIngested += summary.ingested;
    totalSkipped += summary.skipped;
    errors.push(...summary.errors);
  }

  console.info(
    `[metrics-ingestion] cron complete projects=${projectIds.length} ingested=${totalIngested} skipped=${totalSkipped}`
  );

  return {
    projects: projectIds.length,
    results,
    totalIngested,
    totalSkipped,
    errors,
  };
}
