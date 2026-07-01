/**
 * CLI: verify production infrastructure readiness for Loop 1.
 *
 * Usage:
 *   npm run verify:loop1-production
 *
 * Optional:
 *   VERIFY_WORKER_LIVE=1 npm run verify:loop1-production
 *
 * This is a preflight check. It does not start a Growth Run.
 */
import { createClient } from "@supabase/supabase-js";
import { DeleteObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

type CheckStatus = "pass" | "warn" | "fail";

interface Check {
  group: string;
  name: string;
  status: CheckStatus;
  detail: string;
}

const checks: Check[] = [];

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

function add(group: string, name: string, status: CheckStatus, detail: string) {
  checks.push({ group, name, status, detail });
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function requireEnv(group: string, name: string) {
  const value = env(name);
  add(group, name, value ? "pass" : "fail", value ? "configured" : "missing");
  return value;
}

function optionalEnv(group: string, name: string, reason: string) {
  const value = env(name);
  add(group, name, value ? "pass" : "warn", value ? "configured" : reason);
  return value;
}

function redactUrl(url: string | null): string {
  if (!url) return "missing";
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return "invalid URL";
  }
}

function checkVercelCronConfig() {
  const filePath = join(process.cwd(), "vercel.json");
  if (!existsSync(filePath)) {
    add("vercel-cron", "vercel.json", "warn", "missing; use Supabase pg_cron or another scheduler");
    return;
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      crons?: Array<{ path?: string; schedule?: string }>;
    };
    const crons = parsed.crons ?? [];
    const required = [
      "/api/cron/metrics-ingestion",
      "/api/cron/trendhop",
      "/api/cron/render-worker",
    ];

    for (const path of required) {
      const cron = crons.find((entry) => entry.path === path);
      add(
        "vercel-cron",
        path,
        cron ? "pass" : "warn",
        cron?.schedule ? `scheduled ${cron.schedule}` : "not present in vercel.json"
      );
    }
  } catch (err) {
    add(
      "vercel-cron",
      "vercel.json",
      "warn",
      `could not parse vercel.json: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

async function checkSupabaseSchema(url: string, serviceRoleKey: string) {
  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tableChecks: Array<{
    table: string;
    select: string;
    name: string;
  }> = [
    {
      table: "growth_runs",
      select: "id, phase, current_stage, phase_status",
      name: "growth run spine",
    },
    {
      table: "growth_run_sla_events",
      select:
        "id, growth_run_id, stage_id, phase, queued_at, started_at, completed_at, duration_ms, provider_latency_ms, retry_count",
      name: "stage SLA telemetry",
    },
    {
      table: "video_production_jobs",
      select:
        "id, growth_run_id, concept_id, status, current_stage, queued_at, render_started_at, render_completed_at, render_duration_ms",
      name: "Stage 3 queue/timing",
    },
    {
      table: "generated_assets",
      select: "id, growth_run_id, kind, status, public_url, storage_path",
      name: "rendered media assets",
    },
    {
      table: "videos",
      select: "id, growth_run_id, concept_id, status, final_asset_id",
      name: "video readiness",
    },
    {
      table: "metrics_snapshots",
      select: "id, project_id, video_id",
      name: "measurement snapshots",
    },
    {
      table: "growth_experiment_results",
      select: "id, project_id, classification",
      name: "compound results",
    },
  ];

  async function selectWithRetry(table: string, select: string) {
    let lastError: { message?: string } | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      const { error } = await admin.from(table).select(select).limit(1);
      if (!error) return { error: null, attempts: attempt };
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
    return { error: lastError, attempts: 3 };
  }

  for (const check of tableChecks) {
    const { error, attempts } = await selectWithRetry(check.table, check.select);
    add(
      "supabase-schema",
      check.name,
      error ? "fail" : "pass",
      error
        ? `${check.table}: ${error.message ?? "unknown error"} after ${attempts} attempt(s)`
        : `${check.table}: ok${attempts > 1 ? ` after ${attempts} attempts` : ""}`
    );
  }
}

async function checkWorkerLive() {
  const workerUrl = env("AUTOSCALE_RENDER_WORKER_URL");
  const workerSecret = env("AUTOSCALE_RENDER_WORKER_SECRET");
  if (!workerUrl) return;
  if (process.env.VERIFY_WORKER_LIVE !== "1") {
    add(
      "cloud-run",
      "worker live checks",
      "warn",
      "skipped; set VERIFY_WORKER_LIVE=1 to call /health and authenticated /run"
    );
    return;
  }

  const baseUrl = workerUrl.replace(/\/$/, "");
  try {
    const res = await fetch(`${baseUrl}/health`, {
      signal: AbortSignal.timeout(10_000),
    });
    add(
      "cloud-run",
      "worker health live check",
      res.ok ? "pass" : "fail",
      `HTTP ${res.status}`
    );
  } catch (err) {
    add(
      "cloud-run",
      "worker health live check",
      "fail",
      err instanceof Error ? err.message : String(err)
    );
  }

  if (!workerSecret) {
    add("cloud-run", "worker run auth check", "fail", "AUTOSCALE_RENDER_WORKER_SECRET missing");
    return;
  }

  try {
    const res = await fetch(`${baseUrl}/run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workerSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ maxBatches: 0 }),
      signal: AbortSignal.timeout(30_000),
    });
    add(
      "cloud-run",
      "worker run auth check",
      res.ok ? "pass" : "fail",
      `HTTP ${res.status}`
    );
  } catch (err) {
    add(
      "cloud-run",
      "worker run auth check",
      "fail",
      err instanceof Error ? err.message : String(err)
    );
  }
}

async function checkR2Live() {
  if ((env("GROWTH_MEDIA_STORAGE_PROVIDER") ?? "supabase") !== "r2") return;

  const accountId = env("CLOUDFLARE_R2_ACCOUNT_ID");
  const accessKeyId = env("CLOUDFLARE_R2_ACCESS_KEY_ID");
  const secretAccessKey = env("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  const bucket = env("CLOUDFLARE_R2_BUCKET");
  const publicBaseUrl = env("CLOUDFLARE_R2_PUBLIC_BASE_URL");
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBaseUrl) return;

  if (process.env.VERIFY_R2_LIVE !== "1") {
    add(
      "r2",
      "live write/read check",
      "warn",
      "skipped; set VERIFY_R2_LIVE=1 to write, verify, and delete a probe object"
    );
    return;
  }

  const key = `preflight/${Date.now()}-${Math.random().toString(36).slice(2)}.txt`;
  const body = Buffer.from(`autoscale-r2-preflight ${new Date().toISOString()}\n`, "utf8");
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: "text/plain",
        CacheControl: "no-store",
      })
    );
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    add("r2", "object write/head", "pass", `probe object ok: ${key}`);

    const publicUrl = `${publicBaseUrl.replace(/\/$/, "")}/${key}`;
    try {
      const res = await fetch(publicUrl, { signal: AbortSignal.timeout(10_000) });
      add("r2", "public URL fetch", res.ok ? "pass" : "fail", `HTTP ${res.status} ${publicUrl}`);
    } catch (err) {
      add(
        "r2",
        "public URL fetch",
        "fail",
        err instanceof Error ? err.message : String(err)
      );
    }
  } catch (err) {
    add("r2", "object write/head", "fail", err instanceof Error ? err.message : String(err));
  } finally {
    try {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      add("r2", "probe cleanup", "pass", `deleted ${key}`);
    } catch (err) {
      add("r2", "probe cleanup", "warn", err instanceof Error ? err.message : String(err));
    }
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl =
    env("SUPABASE_URL") ?? env("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = env("SUPABASE_SERVICE_ROLE_KEY");

  add(
    "vercel-app",
    "NEXT_PUBLIC_APP_URL",
    env("NEXT_PUBLIC_APP_URL") ? "pass" : "warn",
    env("NEXT_PUBLIC_APP_URL") ?? "missing; required before final Vercel production verification"
  );
  checkVercelCronConfig();
  requireEnv("supabase", "NEXT_PUBLIC_SUPABASE_URL");
  requireEnv("supabase", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  requireEnv("supabase", "SUPABASE_SERVICE_ROLE_KEY");

  const storageProvider = env("GROWTH_MEDIA_STORAGE_PROVIDER") ?? "supabase";
  add(
    "r2",
    "GROWTH_MEDIA_STORAGE_PROVIDER",
    storageProvider === "r2" ? "pass" : "warn",
    storageProvider === "r2"
      ? "r2 selected"
      : "not r2; rendered media will use Supabase Storage fallback"
  );
  if (storageProvider === "r2") {
    requireEnv("r2", "CLOUDFLARE_R2_ACCOUNT_ID");
    requireEnv("r2", "CLOUDFLARE_R2_ACCESS_KEY_ID");
    requireEnv("r2", "CLOUDFLARE_R2_SECRET_ACCESS_KEY");
    requireEnv("r2", "CLOUDFLARE_R2_BUCKET");
    requireEnv("r2", "CLOUDFLARE_R2_PUBLIC_BASE_URL");
  } else {
    optionalEnv("r2", "CLOUDFLARE_R2_PUBLIC_BASE_URL", "missing because r2 is not selected");
  }
  await checkR2Live();

  requireEnv("cloud-run", "AUTOSCALE_RENDER_WORKER_URL");
  requireEnv("cloud-run", "AUTOSCALE_RENDER_WORKER_SECRET");
  optionalEnv(
    "cloud-run",
    "AUTOSCALE_RENDER_CONCEPT_CONCURRENCY",
    "missing; default render worker concurrency will be used"
  );

  const hasReasoningProvider = Boolean(
    env("OPENROUTER_API_KEY") || env("OPENAI_API_KEY") || env("ANTHROPIC_API_KEY")
  );
  add(
    "ai",
    "reasoning provider",
    hasReasoningProvider ? "pass" : "fail",
    hasReasoningProvider
      ? "at least one LLM provider configured"
      : "set OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY"
  );
  optionalEnv("ai", "FAL_KEY", "optional; only needed for premium cinematic path");
  optionalEnv(
    "voiceover",
    "ELEVENLABS_API_KEY",
    "missing; OpenAI TTS or music-only can still support turbo path"
  );
  optionalEnv(
    "voiceover",
    "OPENAI_API_KEY",
    "missing; ElevenLabs TTS or music-only can still support turbo path"
  );

  optionalEnv(
    "publishing",
    "POST_BRIDGE_API_KEY",
    "missing; Loop 1 can export manually but schedule/post will not be live"
  );
  optionalEnv(
    "publishing",
    "POSTIZ_API_KEY",
    "missing; OK if Post Bridge or export_only is used"
  );

  if (supabaseUrl && serviceRole) {
    add("supabase", "admin connection target", "pass", redactUrl(supabaseUrl));
    await checkSupabaseSchema(supabaseUrl, serviceRole);
  } else {
    add(
      "supabase-schema",
      "schema checks",
      "fail",
      "skipped because Supabase URL or service role key is missing"
    );
  }

  await checkWorkerLive();

  const failures = checks.filter((check) => check.status === "fail");
  const warnings = checks.filter((check) => check.status === "warn");

  for (const check of checks) {
    const label = check.status.toUpperCase().padEnd(4);
    console.log(`[${label}] ${check.group} / ${check.name} - ${check.detail}`);
  }
  console.log("");
  console.log(
    `Loop 1 production preflight: ${failures.length ? "FAIL" : "PASS"} (${failures.length} fail, ${warnings.length} warn)`
  );

  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
