/**
 * CLI: verify one completed Loop 1 run contract.
 *
 * Usage:
 *   npm run verify:loop1-run -- --project-id <project-id> --run-id <growth-run-id>
 *
 * Optional:
 *   npm run verify:loop1-run -- --project-id <project-id> --run-id <growth-run-id> --require-metrics
 *   npm run verify:loop1-run -- --project-id <project-id> --run-id <growth-run-id> --stage-sla-ms 60000
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatLoop1ContractReport, verifyLoop1Contract } from "../services/growth-run/loop1-contract";

function loadLocalEnv() {
  for (const filename of [".env.local", ".env"]) {
    const filePath = join(process.cwd(), filename);
    if (!existsSync(filePath)) continue;
    const contents = readFileSync(filePath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key] != null) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function parseArgs(argv: string[]) {
  const parsed: {
    projectId?: string;
    runId?: string;
    requireMetrics: boolean;
    stageSlaMs: number;
  } = {
    requireMetrics: false,
    stageSlaMs: 60_000,
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "--project-id") parsed.projectId = argv[++index];
    else if (arg === "--run-id") parsed.runId = argv[++index];
    else if (arg === "--require-metrics") parsed.requireMetrics = true;
    else if (arg === "--stage-sla-ms") {
      const value = Number(argv[++index]);
      if (Number.isFinite(value) && value > 0) parsed.stageSlaMs = value;
    }
  }

  return parsed;
}

async function main() {
  loadLocalEnv();
  const args = parseArgs(process.argv.slice(2));

  if (!args.projectId || !args.runId) {
    console.error("Missing required args: --project-id <project-id> --run-id <growth-run-id>");
    process.exit(2);
  }

  const supabaseUrl = env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    console.error("Missing SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(2);
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: project } = await admin
    .from("projects")
    .select("name")
    .eq("id", args.projectId)
    .maybeSingle();

  const report = await verifyLoop1Contract({
    client: admin,
    projectId: args.projectId,
    growthRunId: args.runId,
    projectName: project?.name ?? "AutoScale project",
    requireMetrics: args.requireMetrics,
    stageSlaMs: args.stageSlaMs,
  });

  console.log(formatLoop1ContractReport(report));
  process.exit(report.passed ? 0 : 1);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : String(err));
  process.exit(1);
});
