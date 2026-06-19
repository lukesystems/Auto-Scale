# AI Runtime

AutoScale routes all AI calls through `services/ai/runtime.ts`.

## generateText vs generateObject

| Function | Purpose | Response mode |
|----------|---------|---------------|
| `generateText()` | Normal prose/text output | `responseMode: "text"` default |
| `generateObject()` | Structured JSON validated by Zod | Forces `responseMode: "json"` internally |

Use `generateObject()` when you need typed, schema-validated JSON.

This includes:

- AutoBrief
- TrendWatch
- source classification
- future Scraping Engine discovery plans
- future source candidate filtering
- future pattern mining
- hooks
- posts
- compound outputs

Use `generateText()` only when free-form text is acceptable and does not become a critical persisted system object.

## responseMode

`GenerateTextParams.responseMode` controls whether the OpenAI-compatible adapter sends `response_format: { type: "json_object" }`:

- `"text"` — no `response_format`; provider returns normal text
- `"json"` — JSON object mode where supported

`generateObject()` always passes `responseMode: "json"`. It also:

1. Strips markdown fences from the response.
2. Parses JSON.
3. Validates with Zod.
4. Retries once on validation failure.
5. Throws `AIError` if structured output still fails.

## Providers

Supported providers: `openai`, `anthropic`, `openrouter`.

OpenRouter uses the OpenAI-compatible adapter at `https://openrouter.ai/api/v1/chat/completions` with:

- `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Optional `HTTP-Referer` and `X-OpenRouter-Title` from app config

Model slugs are configured through env vars. See [MODEL_ROUTING.md](./MODEL_ROUTING.md).

## Timeout

`AI_REQUEST_TIMEOUT_MS` default `45000` aborts hung provider requests server-side.

When a request times out, the adapter throws:

```txt
AI request timed out after 45000ms. Try a faster model or check provider status.
```

## Scraping Engine AI rules

The Scraping Engine must use structured runtime calls.

Required future structured outputs:

```txt
DiscoveryPlan
SourceCandidateList
SourceClassification
PatternBrief
MarketSourceMap
```

The AI may infer strategy only after the source evidence is stored or passed in. It must not fabricate metrics, creators, source URLs, or platform performance.

Recommended runtime flow:

```txt
Product Brief
→ generateObject(DiscoveryPlan)
→ adapter fetch/search outside the LLM
→ generateObject(SourceCandidateFilter)
→ safe fetch/enrich sources outside the LLM
→ generateObject(SourceClassification / PatternBrief)
→ TrendWatch generateObject(TrendWatchAnalysis)
```

The LLM thinks and classifies. Deterministic code fetches, validates, deduplicates, stores, and enforces confidence.

## Troubleshooting AutoBrief spinning

If AutoBrief hangs or fails during onboarding, check:

1. `OPENROUTER_API_KEY` — set for managed/production mode
2. Model slug — `AUTOSCALE_MODEL_AUTOBRIEF` or fallback env vars
3. Model JSON support — structured AutoBrief requires valid JSON in JSON mode
4. `AI_REQUEST_TIMEOUT_MS` — increase only if models are consistently slow
5. Provider status — OpenRouter or upstream model outages

There is no synthetic provider fallback. Local development needs a real provider key when exercising AI generation.

## Troubleshooting future Scraping Engine runs

Check:

1. Product Brief exists and is not empty.
2. Discovery plan output passed schema validation.
3. Adapters returned candidate sources.
4. Safe fetch did not reject or fail all candidates.
5. Classification output passed schema validation.
6. TrendWatch received enriched sources and confidence reasons.

If evidence is weak, return weak/low-confidence output. Do not fake confidence.

## Logging

Every AI call should be logged via `logAIRun()` for `/debug/ai-runs`. API keys are never logged.

For Scraping Engine work, log:

- task type
- provider/model
- project ID
- source/candidate counts, not huge raw payloads
- validation errors
- failure reasons
- latency
