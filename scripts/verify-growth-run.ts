/**
 * CLI: verify one Growth Run end-to-end.
 *
 * Usage:
 *   npx tsx scripts/verify-growth-run.ts <project_id> <growth_run_id>
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env (admin read).
 */
import { createClient } from "@supabase/supabase-js";
import { verifyGrowthRun, formatVerifyReport } from "../services/growth-run/verify";

async function main() {
  const projectId = process.argv[2];
  const growthRunId = process.argv[3];

  if (!projectId || !growthRunId) {
    console.error("Usage: npx tsx scripts/verify-growth-run.ts <project_id> <growth_run_id>");
    process.exit(1);
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  // Patch admin client for script context — verify uses createSupabaseAdminClient
  // which reads the same env vars when imported in Node.
  process.env.NEXT_PUBLIC_SUPABASE_URL = url;

  const admin = createClient(url, key);
  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project?.owner_id) {
    console.error("Project not found");
    process.exit(1);
  }

  const report = await verifyGrowthRun({
    projectId,
    growthRunId,
    ownerId: project.owner_id,
    useServiceRole: true,
  });

  console.log(formatVerifyReport(report));
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
