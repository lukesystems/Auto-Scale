# AutoBrief Onboarding

AutoBrief is the first context layer in AutoScale.

It turns a startup/product URL into a structured Product Brief and first project. The Product Brief becomes the source of truth for the Scraping Engine, TrendWatch, content generation, experiments, and compounding.

## Role in the new direction

AutoBrief does **not** perform deep competitor research by itself.

Its job is:

```txt
Product URL
→ safe website fetch
→ product understanding
→ editable Product Brief
→ seed competitors/sources/search angles
→ Scraping Engine handoff
```

The Scraping Engine comes after AutoBrief and uses the brief to discover competitor/source evidence.

## Flow

1. **Provider mode** — Managed default, Advanced where supported.
2. **Website URL** — user provides one product/startup URL.
3. **Safe fetch** — server-side fetch reads public website content.
4. **AutoBrief generation** — structured LLM output using task type `autobrief`.
5. **Review / edit** — required when confidence is low or fetch failed.
6. **Confirm** — creates/updates project, `product_briefs`, competitors, and source suggestions.
7. **Next step** — Scraping Engine uses the saved brief to create a discovery plan.

Route: `/onboarding`

## Schema

Output validated by `services/autobrief/schema.ts`:

- Product fields: name, URL, summary, ICP, pain, promise, offer, CTA, niche
- `pricing` — model, free tier/trial flags, tiers (name/price/billing period/notes)
- `positioning_angles`, `content_pillars`, `brand_voice`
- `production_constraints` for likely content production limits
- `suggested_competitors` — names with optional URLs and confidence
- `suggested_sources` — platform/URL suggestions for TrendWatch/Scraping Engine
- `confidence_score`, `missing_information`

## Website fetch

Uses `services/autobrief/fetch-site.ts`, which wraps safe fetch behavior from TrendWatch ingestion.

Current fetch behavior:

- HTTP/HTTPS only
- private/loopback IP protection
- timeout and max body limits
- homepage plus important internal pages such as pricing, features, product, about, solutions, customers
- max 5 pages
- max combined extracted text around 35k characters
- fallback manual entry when readable content is too weak

## What AutoBrief should extract

AutoBrief should capture:

- product name
- one-line description
- category/niche
- target customer
- primary pain
- core promise
- key features and benefits
- visible offer/CTA
- pricing (model, free tier/trial flags, tiers with price/billing period — only what's actually visible on the site, never invented)
- positioning angles
- likely content pillars
- suggested platforms
- likely competitors or alternatives
- missing information
- confidence and extraction notes

## Handoff to Scraping Engine

The Product Brief should give the Scraping Engine enough context to generate discovery queries.

Useful fields for discovery:

- `product_name`
- `product_url`
- `category`
- `niche`
- `target_customer`
- `primary_pain`
- `user_pain_points`
- `core_promise`
- `alternative_solutions`
- `market_category`
- `suggested_competitors`
- `suggested_sources`
- `platform_recommendations`

The Scraping Engine should then create:

```txt
competitor queries
platform queries
pain/problem queries
review/comparison queries
creator/shadow-account queries
community queries
```

## Rules

- Do not hallucinate page content when fetch fails.
- Do not claim competitor URLs are verified unless they were found in provided/fetched context.
- Low confidence (`< 0.55`) requires user review before project creation.
- Suggested competitors are seed candidates, not verified market intelligence.
- Suggested sources are seed candidates, not a finished TrendWatch report.
- Keep AutoBrief narrow. Deep discovery belongs in the Scraping Engine.

## Services

| File | Role |
|------|------|
| `fetch-site.ts` | Safe URL fetch + small product-site crawl |
| `generate.ts` | LLM AutoBrief generation |
| `schema.ts` | Zod schema |
| `create-project.ts` | Persist project + brief + seed competitors/sources |

## Success criteria

AutoBrief succeeds when the founder thinks:

```txt
AutoScale understands my product well enough to start market research.
```

It fails when the output is generic, overconfident, or detached from the website.
