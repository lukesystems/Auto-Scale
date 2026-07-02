import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const REQUIRED_VERCEL_ENV = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTOSCALE_RENDER_WORKER_URL",
  "AUTOSCALE_RENDER_WORKER_SECRET",
  "AUTOSCALE_SCRIPT_STORYBOARD_CONCURRENCY",
  "GROWTH_MEDIA_STORAGE_PROVIDER",
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_PUBLIC_BASE_URL",
  "OPENROUTER_API_KEY",
  "POST_BRIDGE_API_KEY",
] as const;

const REQUIRED_CLOUD_RUN_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTOSCALE_RENDER_WORKER_SECRET",
  "GROWTH_MEDIA_STORAGE_PROVIDER",
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_PUBLIC_BASE_URL",
  "ELEVENLABS_API_KEY",
  "FAL_KEY",
] as const;

function argValue(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function shellMode(): "powershell" | "bash" {
  const value = argValue("--shell", "powershell").toLowerCase();
  return value === "bash" ? "bash" : "powershell";
}

function hasArg(name: string): boolean {
  return process.argv.includes(name);
}

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

function shellQuote(value: string): string {
  return `"${value.replace(/(["`$\\])/g, "\\$1")}"`;
}

function powershellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function vercelEnvCommand(name: string, value: string, showValues: boolean): string {
  if (!showValues) return `vercel env add ${name} production`;
  if (shellMode() === "bash") return `printf ${shellQuote(value)} | vercel env add ${name} production`;
  return `${powershellSingleQuote(value)} | vercel env add ${name} production`;
}

function printVercelCommands() {
  const showValues = hasArg("--show-values");
  console.log("Vercel production env commands:");
  for (const name of REQUIRED_VERCEL_ENV) {
    const value = env(name);
    if (!value) {
      console.log(`# MISSING ${name}`);
      console.log(`# vercel env add ${name} production`);
      continue;
    }
    if (showValues) {
      console.log(vercelEnvCommand(name, value, true));
    } else {
      console.log(`# SET ${name} (${value.length} chars)`);
      console.log(`vercel env add ${name} production`);
    }
  }
}

function printCloudRunCommand() {
  const showValues = hasArg("--show-values");
  const service = argValue("--service", "autoscale-render-worker");
  const region = argValue("--region", "us-central1");
  const pairs: string[] = [
    "NODE_ENV=production",
    "FFMPEG_PATH=/usr/bin/ffmpeg",
    "AUTOSCALE_RENDER_CONCEPT_CONCURRENCY=4",
    "AUTOSCALE_RENDER_WORKER_CLAIM_BATCH=16",
    "AUTOSCALE_RENDER_WORKER_MAX_BATCHES=4",
  ];
  const missing: string[] = [];

  for (const name of REQUIRED_CLOUD_RUN_ENV) {
    const value = env(name);
    if (!value) {
      missing.push(name);
      continue;
    }
    pairs.push(`${name}=${showValues ? value : `<${name}>`}`);
  }

  console.log("");
  console.log("Cloud Run env update command:");
  if (!showValues) {
    console.log("# Values are redacted by default. Re-run with --show-values only in a private terminal.");
  }
  if (missing.length > 0) {
    console.log(`# Missing before Cloud Run update: ${missing.join(", ")}`);
  }
  console.log(
    `gcloud run services update ${service} --region ${region} --update-env-vars ${shellQuote(pairs.join(","))}`
  );
}

loadLocalEnv();
printVercelCommands();
printCloudRunCommand();
