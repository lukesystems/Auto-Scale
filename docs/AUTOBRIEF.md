# AutoBrief Onboarding

AutoBrief is the V1.1 onboarding flow that turns a startup URL into a structured product brief and first project.

## Flow

1. **Provider mode** — Managed (default) or Advanced
2. **Website URL** — safe server-side fetch
3. **AutoBrief generation** — structured LLM output (task: `autobrief`)
4. **Review / edit** — required when confidence is low or fetch failed
5. **Confirm** — creates project, `product_briefs`, competitors, source suggestions

Route: `/onboarding`

## Schema

Output validated by `services/autobrief/schema.ts`:

- Product fields: name, URL, summary, ICP, pain, promise, offer, CTA, niche
- `positioning_angles`, `content_pillars`, `brand_voice`
- `production_constraints` (carousel/video/screenshot/AI flags)
- `suggested_competitors` — names with optional URLs and confidence
- `suggested_sources` — platform/URL suggestions for TrendWatch
- `confidence_score`, `missing_information`

## Website fetch

Uses `services/autobrief/fetch-site.ts` → `safeFetchUrl` from TrendWatch ingestion:

- HTTP/HTTPS only
- SSRF protection (private IP block)
- 8s timeout, 1MB max body
- On failure: manual entry fallback; lower confidence

## Rules

- Do not hallucinate page content when fetch fails
- Do not claim competitor URLs are verified unless fetched
- Low confidence (`< 0.55`) requires user review before project creation

## Services

| File | Role |
|------|------|
| `fetch-site.ts` | Safe URL fetch wrapper |
| `generate.ts` | LLM AutoBrief generation |
| `schema.ts` | Zod schema |
| `create-project.ts` | Persist project + brief + sources |
