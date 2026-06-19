# Model Routing

AutoScale routes AI tasks to different models through environment variables and `services/ai/model-router.ts`.

See also: [AI_RUNTIME.md](./AI_RUNTIME.md) for `generateText` vs `generateObject`, response modes, retries, and timeouts.

## How OpenRouter is used

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Optional headers: `HTTP-Referer`, `X-OpenRouter-Title` from `NEXT_PUBLIC_APP_URL`
- Structured outputs: `response_format: { type: "json_object" }` only when `responseMode: "json"` is used by `generateObject()`
- Normal text: no `response_format` when `responseMode: "text"`
- Timeout: `AI_REQUEST_TIMEOUT_MS` default `45000ms`

Provider is stored in `ai_runs.provider`. Actual model slug is stored in `ai_runs.model`.

## Current task types

| Task | Env var | Used by |
|------|---------|---------|
| `autobrief` | `AUTOSCALE_MODEL_AUTOBRIEF` | AutoBrief onboarding, Product Brief generation |
| `trendwatch` | `AUTOSCALE_MODEL_TRENDWATCH` | TrendWatch analysis, source classification |
| `content` | `AUTOSCALE_MODEL_CONTENT` | Hooks, ideas, post drafts |
| `quality_gate` | `AUTOSCALE_MODEL_QUALITY_GATE` | Future AI-assisted checks |
| `compound` | `AUTOSCALE_MODEL_COMPOUND` | Winner diagnosis, variants |
| `default` | `AUTOSCALE_MODEL_DEFAULT` | Fallback for all tasks |

Resolution:

```txt
task env → AUTOSCALE_MODEL_DEFAULT → AUTOSCALE_DEFAULT_MODEL → provider default
```

## Scraping Engine model direction

The Scraping Engine should use structured model calls only.

Recommended future task types:

| Future task | Purpose |
|------------|---------|
| `source_discovery_plan` | Turn Product Brief into search/discovery query plan |
| `source_candidate_filter` | Rank and deduplicate discovered source candidates |
| `source_classification` | Classify source format, hook, angle, CTA, pain, distortion risk |
| `pattern_mining` | Extract competitor fingerprints, repeated hooks, white space, experiments |

Implementation can initially route these through `trendwatch` to avoid env sprawl. Add separate env vars only when cost/latency/quality differences become real.

Possible future env vars:

```env
AUTOSCALE_MODEL_SOURCE_DISCOVERY=
AUTOSCALE_MODEL_SOURCE_CLASSIFICATION=
AUTOSCALE_MODEL_PATTERN_MINING=
```

Do not add these to production requirements until code uses them.

## Model selection guidance

Use cheaper/faster models for:

- source candidate filtering
- deduplication reasoning
- basic source classification
- short extraction tasks

Use stronger reasoning models for:

- AutoBrief when website copy is messy
- Pattern Miner
- TrendWatch strategy synthesis
- winner diagnosis and compound recommendations

## Swapping models

Change env vars and restart the server. Example:

```env
AUTOSCALE_MODEL_AUTOBRIEF=anthropic/claude-3.5-sonnet
AUTOSCALE_MODEL_TRENDWATCH=openrouter/auto
AUTOSCALE_MODEL_CONTENT=openai/gpt-4o-mini
AUTOSCALE_MODEL_DEFAULT=openrouter/auto
```

Do not hardcode one expensive model everywhere. Different tasks need different cost/latency/quality tradeoffs.

## Failure behavior

There is no synthetic provider fallback for real AI generation. If the selected provider is not configured or the model returns invalid JSON, the runtime throws the real provider/config/schema error and logs the failed AI run.

Scraping Engine agents must fail honestly:

- if source discovery fails, return an empty/low-confidence source map
- if source fetch fails, store `fetch_status = failed`
- if structured model output fails validation, retry once and then mark the run failed
- never silently replace failed evidence with invented competitor intelligence
