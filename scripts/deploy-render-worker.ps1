param(
  [Parameter(Mandatory = $true)]
  [string]$ProjectId,

  [string]$Region = "us-central1",
  [string]$ServiceName = "autoscale-render-worker",
  [string]$ImageName = "autoscale-render-worker",
  [int]$Cpu = 4,
  [string]$Memory = "4Gi",
  [int]$MaxInstances = 5,
  [int]$RenderConcurrency = 4,
  [int]$ClaimBatch = 16,
  [int]$MaxBatches = 4
)

$ErrorActionPreference = "Stop"

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found. Install it before running this script."
  }
}

function Require-Env($Name) {
  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required environment variable: $Name"
  }
  return $value
}

Require-Command "gcloud"

$requiredEnv = @(
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AUTOSCALE_RENDER_WORKER_SECRET",
  "GROWTH_MEDIA_STORAGE_PROVIDER",
  "CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_PUBLIC_BASE_URL"
)

foreach ($name in $requiredEnv) {
  [void](Require-Env $name)
}

$optionalSecretEnv = @(
  "OPENROUTER_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "FAL_KEY"
)

$image = "gcr.io/$ProjectId/$ImageName"

Write-Host "Building render worker image: $image"
gcloud builds submit `
  --project $ProjectId `
  --config cloudbuild.render-worker.yaml `
  --substitutions "_IMAGE=$image"

$envVars = @(
  "NODE_ENV=production",
  "FFMPEG_PATH=/usr/bin/ffmpeg",
  "NEXT_PUBLIC_SUPABASE_URL=$env:NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY=$env:NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY=$env:SUPABASE_SERVICE_ROLE_KEY",
  "AUTOSCALE_RENDER_WORKER_SECRET=$env:AUTOSCALE_RENDER_WORKER_SECRET",
  "GROWTH_MEDIA_STORAGE_PROVIDER=$env:GROWTH_MEDIA_STORAGE_PROVIDER",
  "CLOUDFLARE_R2_ACCOUNT_ID=$env:CLOUDFLARE_R2_ACCOUNT_ID",
  "CLOUDFLARE_R2_ACCESS_KEY_ID=$env:CLOUDFLARE_R2_ACCESS_KEY_ID",
  "CLOUDFLARE_R2_SECRET_ACCESS_KEY=$env:CLOUDFLARE_R2_SECRET_ACCESS_KEY",
  "CLOUDFLARE_R2_BUCKET=$env:CLOUDFLARE_R2_BUCKET",
  "CLOUDFLARE_R2_PUBLIC_BASE_URL=$env:CLOUDFLARE_R2_PUBLIC_BASE_URL",
  "AUTOSCALE_RENDER_CONCEPT_CONCURRENCY=$RenderConcurrency",
  "AUTOSCALE_RENDER_WORKER_CLAIM_BATCH=$ClaimBatch",
  "AUTOSCALE_RENDER_WORKER_MAX_BATCHES=$MaxBatches"
)

foreach ($name in $optionalSecretEnv) {
  $value = [Environment]::GetEnvironmentVariable($name)
  if (-not [string]::IsNullOrWhiteSpace($value)) {
    $envVars += "$name=$value"
  }
}

$envArg = $envVars -join ","

Write-Host "Deploying Cloud Run service: $ServiceName"
gcloud run deploy $ServiceName `
  --project $ProjectId `
  --image $image `
  --region $Region `
  --platform managed `
  --allow-unauthenticated `
  --cpu $Cpu `
  --memory $Memory `
  --concurrency 1 `
  --timeout 900 `
  --min-instances 0 `
  --max-instances $MaxInstances `
  --set-env-vars $envArg

$workerUrl = gcloud run services describe $ServiceName `
  --project $ProjectId `
  --region $Region `
  --format "value(status.url)"

Write-Host ""
Write-Host "Cloud Run worker URL:"
Write-Host $workerUrl
Write-Host ""
Write-Host "Set these in Vercel production:"
Write-Host "AUTOSCALE_RENDER_WORKER_URL=$workerUrl"
Write-Host "AUTOSCALE_RENDER_WORKER_SECRET=<same value used for Cloud Run>"
Write-Host "GROWTH_MEDIA_STORAGE_PROVIDER=r2"
Write-Host ""
Write-Host "Verify after deployment:"
Write-Host "curl $workerUrl/health"
Write-Host "VERIFY_WORKER_LIVE=1 npm run verify:loop1-production"
