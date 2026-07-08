# Scraping Engine (a.k.a. Discovery Engine)

## Purpose

The Discovery Engine turns a saved Product Brief into real market evidence:

```txt
Product Brief
→ discovery query planning
→ search (multi-adapter)
→ candidate normalization + dedupe
→ scoring
→ enrichment (fetch + classify)
→ TrendWatch-ready evidence
```

This is not an analytics dashboard. This is the research and intelligence layer that makes AutoScale useful.

## Correction from the original plan

An earlier version of this doc described a `services/scraping/` directory with isolated per-platform adapter files (`x.ts`, `tiktok.ts`, `linkedin.ts`, etc). **That directory was never built.** What actually got built is more capable but lives somewhere else:

```txt
services/intelligence/discovery/    — planning, search, scoring, dedupe, enrichment orchestration
services/intelligence/deep-discovery/ — agentic multi-step discovery loop
services/intelligence/adapters/     — search + crawl adapters (currently: Firecrawl only)
services/intelligence/patterns/     — pattern mining over enriched sources
services/intelligence/scoring/      — source-level scoring
services/intelligence/video/        — video evidence discovery/scoring
```

This doc now describes what is actually running.

## Current implementation baseline (verified against code, 2026-07-06)

- AutoBrief safely fetches a product site and creates a structured product brief (`services/autobrief/*`). Verified against 5 real URLs — reliable as of this pass; pricing extraction added.
- `services/intelligence/discovery/plan-discovery.ts` — an LLM generates 8–15 search queries per brief (`DiscoveryPlan`), tagged with an `intent` (`competitor`, `pain`, `shadow_account`, `distribution`, etc.) and an optional `platform_hint`. Falls back to a deterministic template plan if the LLM call fails.
- `services/intelligence/discovery/run-discovery.ts` — runs the plan, dedupes, scores, optionally enriches, and saves `source_candidates` rows.
- **Search adapter reality: only Firecrawl is wired up.** `services/intelligence/adapters/index.ts` lists a single `SearchAdapter` (`firecrawlSearchAdapter`, calling Firecrawl's generic `/v1/search`). `EXA_API_KEY` exists in `.env.example` and discovery-run rows are stamped `primaryAdapter: "exa"` in `run-discovery.ts` — **this label is stale/misleading**. There is no Exa or Brave adapter in the codebase; nothing besides Firecrawl actually runs.
- **No platform-specific adapters exist at all.** "X discovery" today is the LLM planner generating `site:x.com ...` style queries and routing them through the same generic Firecrawl web search as everything else. There is no engagement signal (no likes/retweets/views), no account-type detection, no recency weighting specific to X — `services/intelligence/discovery/score-candidate.ts` scores purely on URL/text heuristics (keyword overlap, URL path patterns like `/pricing`), never on real engagement numbers, because no adapter returns engagement numbers.
- Candidate scoring (`score-candidate.ts`) produces `competitorLikelihood`, `audienceRelevance`, `evidenceRichness`, `platformValue`, and a combined `strategicValue` — all derived from text, never from platform-native metrics.
- Pattern mining (`services/intelligence/patterns/*`) and deep discovery (`services/intelligence/deep-discovery/*`) already exist and operate on whatever candidates discovery produces — quality is bounded by input quality, i.e. by the adapter gap above.

## What is missing

```txt
Real engagement signal for X (likes, retweets, replies, views/impressions),
account-type classification, and recency-weighted ranking —
none of which generic web search can return.
```

That is the actual gap this build closes.

## Decision: X retrieval provider

Considered and rejected for now:
- **Self-hosted open-source X scraper** (twscrape-style, hosted on a separate server) — full control, no per-call fee, but an ongoing maintenance war against X's anti-bot defenses (breaks every few months, needs residential proxy rotation), and it's exactly the kind of infrastructure project this doc's original version warned against building first.
- **Official X API (Basic tier, ~$200/mo)** — ToS-safe, real metrics, zero scraper maintenance, but was not selected.

**Chosen: Apify managed actors.** Pay-per-result hosted scraping for X (and later TikTok/IG) without owning scraper infrastructure or fighting the anti-bot arms race.

**Status: built and live** (actor: `api-ninja/x-twitter-advanced-search` — chosen over the alternatives for built-in engagement-tier presets and actual view/impression counts).

## X adapter architecture (Apify-backed)

### 1. New adapter, same interface pattern already in the codebase

`services/intelligence/adapters/apify-x-adapter.ts` implements the existing `SearchAdapter` interface (no separate type needed — `SearchResult` itself grew optional engagement fields, see below) and calls the actor via `run-sync-get-dataset-items`. It slots into the existing `searchAdapters` array (`services/intelligence/adapters/index.ts`) and the existing multi-adapter merge logic in `services/intelligence/discovery/search-coverage.ts` (`searchWithCoverage`).

### 2. Extended the result type to carry real signal

`SearchResult` (`services/intelligence/types.ts`) gained optional fields rather than a separate subtype — keeps every existing adapter/consumer unchanged, since the fields are `undefined` for generic web-search results:

```ts
export interface SearchResult {
  url: string;
  title: string | null;
  snippet: string | null;
  publishedAt: string | null;
  accountHandle?: string | null;
  accountType?: "official" | "creator" | "shadow" | "unknown";
  engagement?: { likes: number | null; reposts: number | null; replies: number | null; views: number | null } | null;
}
```

### 3. Routing: only invoke Apify for X-intent queries

Not every discovery query should hit Apify (cost control). In `run-discovery.ts`, route queries where `platform_hint === "x"` (or `intent` is `creator` / `shadow_account` / `distribution` and the planner suggests X) through the Apify adapter using the query's *topic keywords* directly (not `site:x.com` search-engine syntax — Apify's X actors take native X search operators, not Google-style site: filters). Everything else stays on Firecrawl.

### 4. Scoring: make engagement a first-class signal

`score-candidate.ts`'s `scoreEvidenceRichness` and `scorePlatformValue` currently have no engagement input. Add a `scoreEngagementSignal` dimension for X candidates (recency-weighted: recent, high-engagement, low-follower-count-relative-to-engagement posts should outrank celebrity virality), and fold it into `scoreStrategicValue`.

### 5. Storage: extend `source_candidates`

New migration adding discovery/engagement metadata (extends the existing table rather than creating new ones, per the original build discipline):

```sql
alter table public.source_candidates
  add column if not exists account_type text,
  add column if not exists engagement_metrics jsonb,
  add column if not exists posted_at timestamptz,
  add column if not exists transferability_score numeric;
```

### 6. IG/TikTok: stay light, per plan

No Apify actor for IG/TikTok yet. Keep them on the existing Firecrawl generic-search path with `platform_hint` filters — caption/text-level hits only, no engagement metrics, no deep scraping. Revisit only after the X path proves out and volume/budget justify it.

## Open items before implementation starts

- ~~Apify account + `APIFY_API_TOKEN`~~ — done. Actor: `api-ninja/x-twitter-advanced-search` (`APIFY_X_ACTOR_ID` default).
- ~~Budget cap~~ — done. 75 results/discovery-run (`MAX_APIFY_RESULTS_PER_RUN` in `run-discovery.ts`).

## What not to build yet

Unchanged from the original plan:

- full browser automation
- headless TikTok scraping hacks
- self-hosted scraper infrastructure (see decision above)
- huge analytics dashboards
- autonomous posting
- revenue attribution before source intelligence works

## Success criteria

Unchanged: a founder pastes a URL and gets back "here's what's working on X for your niche, and here are concepts tailored to you" — grounded in real engagement data, not just text-similarity search hits.
