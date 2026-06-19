# AI Runtime

AutoScale routes all AI calls through `services/ai/runtime.ts`.

## generateText vs generateObject

| Function | Purpose | Response mode |
|----------|---------|---------------|
| `generateText()` | Normal prose/text output | `responseMode: "text"` (default) |
| `generateObject()` | Structured JSON validated by Zod | Forces `responseMode: "json"` internally |

**Use `generateObject`** when you need typed, schema-validated JSON (AutoBrief, TrendWatch, hooks, posts, compound outputs).

**Use `generateText`** when you need free-form text without JSON constraints.

## responseMode

`GenerateTextParams.responseMode` controls whether the OpenAI-compatible adapter sends `response_format: { type: "json_object" }`:

- `"text"` (default) — no `response_format`; provider returns normal text
- `"json"` — forces JSON object mode where the provider supports it

`generateObject()` always passes `responseMode: "json"`. It also:

1. Strips markdown fences from the response
2. Parses JSON
3. Validates with Zod
4. Retries once on validation failure
5. Throws `AIError` if structured output still fails

## Providers

Supported providers: `openai`, `anthropic`, `openrouter`.

OpenRouter uses the OpenAI-compatible adapter at `https://openrouter.ai/api/v1/chat/completions` with:

- `Authorization: Bearer ${OPENROUTER_API_KEY}`
- Optional `HTTP-Referer` and `X-OpenRouter-Title` from app config

Model slugs are configured via env vars — see [MODEL_ROUTING.md](./MODEL_ROUTING.md).

## Timeout

`AI_REQUEST_TIMEOUT_MS` (default: `45000`) aborts hung provider requests server-side.

When a request times out, the adapter throws:

```txt
AI request timed out after 45000ms. Try a faster model or check provider status.
```

## Troubleshooting AutoBrief spinning

If AutoBrief hangs or fails during onboarding, check:

1. **`OPENROUTER_API_KEY`** — set for managed/production mode
2. **Model slug** — `AUTOSCALE_MODEL_AUTOBRIEF` or fallback env vars
3. **Model JSON support** — structured AutoBrief requires a model that returns valid JSON in JSON mode
4. **`AI_REQUEST_TIMEOUT_MS`** — increase only if models are consistently slow; default 45s is usually enough
5. **Provider status** — OpenRouter or upstream model outages

There is no synthetic provider fallback. Local development needs a real provider key when exercising AI generation.

## Logging

Every AI call should be logged via `logAIRun()` for `/debug/ai-runs`. API keys are never logged.
