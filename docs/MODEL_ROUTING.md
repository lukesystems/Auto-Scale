# Model Routing

AutoScale routes AI tasks to different OpenRouter models via environment variables.

## How OpenRouter is used

- Endpoint: `https://openrouter.ai/api/v1/chat/completions`
- Auth: `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Optional headers: `HTTP-Referer`, `X-OpenRouter-Title` (from `NEXT_PUBLIC_APP_URL`)
- Structured outputs: `response_format: { type: "json_object" }` via OpenAI-compatible adapter

Provider stored in `ai_runs.provider` as `openrouter`. Actual model slug stored in `ai_runs.model`.

## Task types

| Task | Env var | Used by |
|------|---------|---------|
| `autobrief` | `AUTOSCALE_MODEL_AUTOBRIEF` | AutoBrief onboarding, product brief |
| `trendwatch` | `AUTOSCALE_MODEL_TRENDWATCH` | TrendWatch analysis |
| `content` | `AUTOSCALE_MODEL_CONTENT` | Hooks, ideas, post drafts |
| `quality_gate` | `AUTOSCALE_MODEL_QUALITY_GATE` | Future AI-assisted checks |
| `compound` | `AUTOSCALE_MODEL_COMPOUND` | Winner diagnosis, variants |
| `default` | `AUTOSCALE_MODEL_DEFAULT` | Fallback for all tasks |

Resolution: `task env → AUTOSCALE_MODEL_DEFAULT → AUTOSCALE_DEFAULT_MODEL → provider default`

Implementation: `services/ai/model-router.ts`

## Swapping models

Change env vars and restart the server. Example:

```env
AUTOSCALE_MODEL_AUTOBRIEF=anthropic/claude-3.5-sonnet
AUTOSCALE_MODEL_CONTENT=openai/gpt-4o-mini
AUTOSCALE_MODEL_DEFAULT=openrouter/auto
```

Do not hardcode Opus/GPT everywhere — different tasks benefit from different cost/latency/quality tradeoffs.

## Mock fallback

If `OPENROUTER_API_KEY` is missing (or `AUTOSCALE_DEFAULT_PROVIDER=mock`), the runtime uses the mock adapter. Prompts with `[[kind]]` tags return deterministic JSON for local dev and tests.
