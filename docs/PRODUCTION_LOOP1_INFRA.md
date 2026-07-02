# AutoScale Production Loop 1 Infrastructure

This guide prepares AutoScale for the first production loop:

```txt
evidence -> hypothesis -> 3 videos -> schedule/export -> measure
```

The goal is high experiment throughput for founders, not cinematic perfection on the critical path. Premium fal/I2V rendering stays optional and async. The default loop should generate usable shorts quickly, learn from distribution, and compound the winning pattern.

## Target Shape

| Layer | Production choice | Role |
| --- | --- | --- |
| App | Vercel | Next.js UI, auth, server actions, lightweight cron routes |
| State | Supabase Postgres | Source of truth for projects, evidence, runs, jobs, experiments, metrics |
| Queue v1 | Supabase-backed `video_production_jobs` | Durable Stage 3 work queue and status graph |
| Render worker | Google Cloud Run | Warm container service with FFmpeg for media jobs |
| Storage/CDN | Cloudflare R2 | Raw/rendered media, public CDN URL |
| AI providers | OpenRouter/OpenAI/Anthropic + fal optional | LLM reasoning by task; fal only for premium cinematic scenes |
| Telemetry | Postgres SLA columns/tables | queued, started, completed, duration, provider latency, retry count |

## Platform Setup Order

Do setup in this order. Later platforms depend on values created by earlier platforms.

1. Supabase:
   - Create or select the production Supabase project.
   - Apply migrations.
   - Copy `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`.
   - Keep the service-role key server-only.

2. Cloudflare R2:
   - Create the media bucket.
   - Create a bucket-scoped R2 token.
   - Configure a public custom domain or public bucket URL.
   - Copy account id, access key id, secret access key, bucket name, and public base URL.

3. Google Cloud:
   - Enable Cloud Build, Artifact Registry or Container Registry, and Cloud Run.
   - Build `Dockerfile.render-worker`.
   - Deploy the Cloud Run render worker.
   - Set Supabase, R2, AI/TTS, and worker secret env vars.
   - Copy the Cloud Run service URL.

4. Vercel:
   - Deploy the Next.js app.
   - Set Supabase, app URL, AI, publishing, R2, and Cloud Run worker env vars.
   - Do not run FFmpeg-heavy Stage 3 work inside Vercel.

5. Verification:
   - Run `npm run verify:loop1-production`.
   - Run `VERIFY_WORKER_LIVE=1 npm run verify:loop1-production`.
   - Run one real Growth Run.
   - Run `npm run verify:loop1-run -- --project-id PROJECT_ID --run-id GROWTH_RUN_ID`.

## Env Ownership Matrix

| Env var | Vercel app | Cloud Run worker | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | yes | Public URL, safe client-side |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | yes | Public anon key, RLS-protected |
| `SUPABASE_SERVICE_ROLE_KEY` | yes, server only | yes | Required for trusted queue/worker paths |
| `NEXT_PUBLIC_APP_URL` | yes | no | Production app origin |
| `AUTOSCALE_RENDER_WORKER_URL` | yes | no | Vercel uses this to kick Cloud Run |
| `AUTOSCALE_RENDER_WORKER_SECRET` | yes | yes | Required in production for `POST /run` |
| `AUTOSCALE_SCRIPT_STORYBOARD_CONCURRENCY` | yes | no | Stage 2 speed control |
| `AUTOSCALE_RENDER_CONCEPT_CONCURRENCY` | no | yes | Stage 3 worker parallelism |
| `AUTOSCALE_RENDER_WORKER_CLAIM_BATCH` | no | yes | Worker queue claim size |
| `AUTOSCALE_RENDER_WORKER_MAX_BATCHES` | optional | yes | Worker drain loop bound |
| `GROWTH_MEDIA_STORAGE_PROVIDER` | yes | yes | Set to `r2` in production |
| `CLOUDFLARE_R2_ACCOUNT_ID` | yes | yes | Needed where uploads may happen |
| `CLOUDFLARE_R2_ACCESS_KEY_ID` | yes | yes | Server-side only |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | yes | yes | Server-side only |
| `CLOUDFLARE_R2_BUCKET` | yes | yes | Media bucket |
| `CLOUDFLARE_R2_PUBLIC_BASE_URL` | yes | yes | CDN/public media URL |
| `OPENROUTER_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | yes | optional | LLM routing; worker only needs providers it calls |
| `ELEVENLABS_API_KEY` / OpenAI TTS env | optional | yes | Stage 3 voiceover |
| `FAL_KEY` | optional | optional | Premium cinematic path only |
| `POST_BRIDGE_API_KEY` / `POSTIZ_API_KEY` | yes | no | Stage 4 scheduling |

## Stage SLA Targets

Stage 1 under 60s:
- Run shallow discovery first.
- Use existing product brief, competitor memory, source candidates, and video evidence where possible.
- Deeper enrichment continues after the first run is usable.

Stage 2 under 60s:
- Generate one strategy batch: 1 strategy, 3 concepts, scripts, storyboards.
- Expand variants later through the compound loop.
- Keep `AUTOSCALE_SCRIPT_STORYBOARD_CONCURRENCY=3` so the three first-loop scripts/storyboards run in parallel.

Stage 3 under 60s:
- Use turbo default: `kinetic_text_ad`, `slides_only`, `standard`, `maxAiVideoScenes = 0`.
- No fal scenes on the critical path.
- Use cached voiceover when script hash matches.
- One FFmpeg encode for the primary MP4.
- Platform variants and premium polish should be post-ready work.

Stage 4 under 60s:
- Schedule/export already-ready videos only.
- Do not render or run heavy AI in Stage 4.

## Supabase Setup

1. Apply all migrations, including:

```bash
supabase db push
```

If the Supabase CLI is not installed locally, apply these files in the Supabase dashboard SQL editor, in order:

```txt
supabase/migrations/0035_stage3_render_timing.sql
supabase/migrations/0036_growth_run_sla_events.sql
```

Then refresh the PostgREST schema cache from the SQL editor:

```sql
notify pgrst, 'reload schema';
```

2. Confirm these tables/columns exist:

- `growth_runs`
- `video_production_jobs`
- `videos`
- `generated_assets`
- `metrics_snapshots`
- `growth_experiment_results`
- `growth_run_sla_events`
- `video_production_jobs.queued_at`
- `video_production_jobs.render_started_at`
- `video_production_jobs.render_completed_at`
- `video_production_jobs.render_duration_ms`

3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. It is required by the Cloud Run worker and Vercel server routes, never the browser.

4. Queue v1 is the existing `video_production_jobs` table. The claim contract is:

```txt
queued + awaiting_worker -> claimed/assembling -> ready | failed | partial
```

Use Supabase Queues later only if the job table becomes too hot or if multiple worker fleets need decoupled delivery. For Loop 1, the table is simpler and easier to inspect.

## Cloudflare R2 Setup

1. Create an R2 bucket, for example:

```txt
autoscale-growth-media
```

2. Create an R2 API token with object read/write access to that bucket.

3. Add a public custom domain or public bucket URL for rendered media.

4. Set these env vars in Vercel and Cloud Run:

```bash
GROWTH_MEDIA_STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=autoscale-growth-media
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://media.yourdomain.com
```

If these are missing, uploads fall back to Supabase Storage.

After setting R2 env vars, run a live write/read/delete probe:

```bash
VERIFY_R2_LIVE=1 npm run verify:loop1-production
```

This writes a small object under `preflight/`, verifies it through the S3-compatible API, fetches the public URL, then deletes the probe object. A failure here means Stage 3 may render successfully but fail to publish final MP4 URLs.

## Google Cloud Run Render Worker

The worker container runs FFmpeg and processes Stage 3 jobs out of Supabase.

The worker image uses `.dockerignore` to exclude local secrets, build output, `.git`, `.next`, and `node_modules` from the Cloud Build context. All production secrets must be supplied through Cloud Run environment variables or Secret Manager, not copied into the image.

Generate one shared worker secret before deploy:

```powershell
npm run generate:render-worker-secret -- autoscale-render-worker us-central1
```

Use the generated value for `AUTOSCALE_RENDER_WORKER_SECRET` in both Cloud Run and Vercel. If those values differ, Vercel cron and Growth Run kicks will reach Cloud Run but fail authorization.

The production preflight rejects placeholder values and secrets shorter than 32 characters. Use the helper output instead of a memorable phrase.

Recommended Windows deploy helper:

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL="..."
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY="..."
$env:SUPABASE_SERVICE_ROLE_KEY="..."
$env:AUTOSCALE_RENDER_WORKER_SECRET="use-a-long-random-secret"
$env:GROWTH_MEDIA_STORAGE_PROVIDER="r2"
$env:CLOUDFLARE_R2_ACCOUNT_ID="..."
$env:CLOUDFLARE_R2_ACCESS_KEY_ID="..."
$env:CLOUDFLARE_R2_SECRET_ACCESS_KEY="..."
$env:CLOUDFLARE_R2_BUCKET="autoscale-growth-media"
$env:CLOUDFLARE_R2_PUBLIC_BASE_URL="https://media.yourdomain.com"
$env:OPENROUTER_API_KEY="..."
$env:ELEVENLABS_API_KEY="..."
$env:FAL_KEY="..."

npm run deploy:render-worker -- -ProjectId YOUR_GCP_PROJECT_ID -Region us-central1
```

The helper builds `Dockerfile.render-worker`, deploys the Cloud Run service, prints the worker URL, and prints the Vercel env values to set.

Raw build and deploy equivalent:

```bash
gcloud builds submit \
  --config cloudbuild.render-worker.yaml \
  --substitutions _IMAGE=gcr.io/PROJECT_ID/autoscale-render-worker

gcloud run deploy autoscale-render-worker \
  --image gcr.io/PROJECT_ID/autoscale-render-worker \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --cpu 4 \
  --memory 4Gi \
  --concurrency 1 \
  --timeout 900 \
  --min-instances 0 \
  --max-instances 5 \
  --set-env-vars NODE_ENV=production,FFMPEG_PATH=/usr/bin/ffmpeg,AUTOSCALE_RENDER_CONCEPT_CONCURRENCY=4,AUTOSCALE_RENDER_WORKER_CLAIM_BATCH=16,AUTOSCALE_RENDER_WORKER_MAX_BATCHES=4
```

The service can be `--allow-unauthenticated` because Vercel authenticates `POST /run` with `AUTOSCALE_RENDER_WORKER_SECRET`. In production, `/run` returns `401` if that secret is missing or wrong. Keep `/health` public for uptime checks.

Set secrets either through Secret Manager or Cloud Run env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
AUTOSCALE_RENDER_WORKER_SECRET=...
GROWTH_MEDIA_STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=autoscale-growth-media
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://media.yourdomain.com
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
FAL_KEY=...
```

Health check:

```bash
curl https://YOUR_WORKER_URL/health
```

Manual drain:

```bash
curl -X POST https://YOUR_WORKER_URL/run \
  -H "Authorization: Bearer $AUTOSCALE_RENDER_WORKER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"maxBatches":1}'
```

For under-60-second Stage 3, start with:

```txt
CPU: 4
Memory: 4Gi
Concurrency: 1 Cloud Run request per container
AUTOSCALE_RENDER_CONCEPT_CONCURRENCY: 4
```

Increase `AUTOSCALE_RENDER_CONCEPT_CONCURRENCY` to 8 only after FFmpeg/RAM stays stable.

## Vercel Setup

Deploy the Next.js app to Vercel.

Required Vercel env vars:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app

AUTOSCALE_RENDER_WORKER_URL=https://YOUR_WORKER_URL
AUTOSCALE_RENDER_WORKER_SECRET=...
AUTOSCALE_SCRIPT_STORYBOARD_CONCURRENCY=3

GROWTH_MEDIA_STORAGE_PROVIDER=r2
CLOUDFLARE_R2_ACCOUNT_ID=...
CLOUDFLARE_R2_ACCESS_KEY_ID=...
CLOUDFLARE_R2_SECRET_ACCESS_KEY=...
CLOUDFLARE_R2_BUCKET=autoscale-growth-media
CLOUDFLARE_R2_PUBLIC_BASE_URL=https://media.yourdomain.com

OPENROUTER_API_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
FAL_KEY=...
POST_BRIDGE_API_KEY=...
POSTIZ_API_KEY=...
```

Vercel should not run FFmpeg-heavy rendering. Its job is to enqueue Stage 3 jobs and kick Cloud Run with `POST /run`.

After local env values are set, print the exact Vercel and Cloud Run env propagation commands:

```bash
npm run print:loop1-env-commands -- autoscale-render-worker us-central1
```

Review the output before running it. It marks missing variables with `# MISSING`.
Values are redacted by default so secrets do not end up in logs. Use `--show-values` only in a private terminal if you intentionally want copy-paste commands with values.
The command prints PowerShell-safe Vercel input by default; add `--shell bash` if you are applying values from a Bash terminal.

External scheduler jobs:

```txt
/api/cron/metrics-ingestion  daily at 06:00 UTC
/api/cron/trendhop           hourly
/api/cron/render-worker      every 5 minutes
```

The render-worker cron route is only a Cloud Run kicker in production. If `AUTOSCALE_RENDER_WORKER_URL` is missing, it returns an error instead of running FFmpeg inside Vercel.

## Loop 1 Acceptance Gate

Before running a live project, run the production preflight:

```bash
npm run verify:loop1-production
```

To also call the Cloud Run worker `/health` endpoint and authenticate a no-op `/run` request:

```bash
VERIFY_WORKER_LIVE=1 npm run verify:loop1-production
```

The preflight checks required env vars, R2 configuration, Cloud Run worker URL/secret, LLM provider availability, publishing keys, and Supabase schema columns for the run spine, SLA telemetry, Stage 3 queue, rendered media, metrics, and compound results.

For final production acceptance, run the strict preflight with live R2 and Cloud Run checks:

```bash
npm run verify:loop1-production:strict
```

Strict mode fails if R2 is not selected, the R2 live probe is skipped, Cloud Run live checks are skipped, production URLs are localhost/non-HTTPS, or the Stage 2/3 concurrency env vars are missing or below the first-loop SLA recommendation.

After one real project run, verify the actual Loop 1 contract:

```bash
npm run verify:loop1-run -- --project-id PROJECT_ID --run-id GROWTH_RUN_ID
```

For a post-distribution run where metrics should already exist:

```bash
npm run verify:loop1-run -- --project-id PROJECT_ID --run-id GROWTH_RUN_ID --require-metrics
```

This run-level verifier checks source evidence, hypotheses, exactly 3 first-loop concepts, concept evidence links, 3 ready/exportable MP4s, schedule or export fallback, measurement hooks, and `growth_run_sla_events` under the 60-second SLA.

Before calling Loop 1 production-ready, prove this sequence with one real project:

1. Product URL creates/updates a product brief.
2. Stage 1 creates or reuses evidence and produces a hypothesis with source caveats.
3. Stage 2 creates exactly 3 first-loop concepts with scripts and storyboards.
4. Stage 3 enqueues 3 `video_production_jobs`.
5. Cloud Run claims jobs and uploads MP4s to R2.
6. `videos.status = ready` for all 3.
7. Stage 4 schedules via Post Bridge/Postiz or exports cleanly.
8. Metrics ingestion creates `metrics_snapshots`.
9. Winner classifier creates or updates `growth_experiment_results`.
10. Every post/video/experiment remains linked back to source evidence or a low-confidence caveat.

## Telemetry Queries

Stage 1-4 phase SLA:

```sql
select
  growth_run_id,
  stage_id,
  phase,
  status,
  extract(epoch from (started_at - queued_at)) as queue_wait_seconds,
  duration_ms / 1000.0 as duration_seconds,
  provider_latency_ms / 1000.0 as provider_seconds,
  retry_count,
  completed_at
from growth_run_sla_events
where growth_run_id = 'RUN_ID'
order by stage_id, queued_at nulls last, started_at nulls last;
```

Under-60s stage audit:

```sql
select
  growth_run_id,
  stage_id,
  max(duration_ms) / 1000.0 as slowest_phase_seconds,
  bool_and(coalesce(duration_ms, 0) <= 60000) as all_recorded_phases_under_60s
from growth_run_sla_events
where growth_run_id = 'RUN_ID'
  and completed_at is not null
group by growth_run_id, stage_id
order by stage_id;
```

Stage 3 render cost:

```sql
select
  growth_run_id,
  count(*) as jobs,
  percentile_cont(0.5) within group (order by render_duration_ms) / 1000 as median_seconds,
  max(render_duration_ms) / 1000 as max_seconds
from video_production_jobs
where render_completed_at is not null
group by growth_run_id
order by max(render_completed_at) desc
limit 20;
```

Queue wait:

```sql
select
  id,
  growth_run_id,
  status,
  extract(epoch from (render_started_at - queued_at)) as queue_wait_seconds,
  render_duration_ms / 1000 as render_seconds
from video_production_jobs
where queued_at is not null
order by queued_at desc
limit 50;
```

## Scale Path

Loop 1:
- Supabase job table queue
- One Cloud Run worker service
- R2 media storage

Loop 2:
- Add post-ready polish queue for platform variants and cinematic upgrades.
- Add dedicated SLA table for all phases, not just Stage 3 jobs.

Loop 3:
- Move from table queue to Supabase Queues or Cloudflare Queues if job polling becomes noisy.
- Split workers by type: research, render, metrics, compound.
