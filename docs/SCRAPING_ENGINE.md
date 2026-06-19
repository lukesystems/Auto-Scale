# Scraping Engine

## Purpose

The Scraping Engine is the next core build for AutoScale.

Its job is to turn a saved Product Brief into real market evidence:

```txt
Product Brief
→ source discovery
→ competitor/source map
→ safe fetching
→ source classification
→ signal scoring
→ pattern mining
→ TrendWatch-ready evidence
```

This is not an analytics dashboard. This is the research and intelligence layer that makes AutoScale useful.

## Why this matters

AutoScale should not guess what content will work. It should study what is already working for:

- direct competitors
- indirect competitors
- audience magnets
- creators and shadow accounts
- comparison/review pages
- communities where the target audience complains
- platform-native content formats
- search results that reveal active intent

The output is not “a list of viral posts.” The output is a structured understanding of competitor strategy and market patterns.

## Current implementation baseline

The codebase already has these pieces:

- AutoBrief safely fetches a product site and creates a structured product brief.
- TrendWatch sources can be added manually.
- Source URLs are safely fetched through the ingestion layer.
- Sources are enriched, classified, scored, and given confidence reasons.
- TrendWatch analyzes enriched sources and stores insights.

What is missing is autonomous discovery:

```txt
Given this product brief, go find the relevant competitor/source evidence.
```

That missing layer is the Scraping Engine.

## Product flow

```txt
1. Founder pastes product URL.
2. AutoBrief creates product context.
3. Scraping Engine generates discovery queries.
4. Discovery adapters search web/social/product surfaces.
5. Candidate sources are normalized and deduplicated.
6. Sources are fetched safely where possible.
7. Sources are classified and scored.
8. AI performs pattern mining over the evidence.
9. TrendWatch produces strategy, hooks, formats, and experiments.
10. Content Conveyor creates experiments tied to sourced insights.
```

## Engine modules

### 1. Discovery Planner

Input: Product Brief.

Output: query plan.

It should generate:

- direct competitor queries
- indirect competitor queries
- platform-specific queries
- pain/problem queries
- alternative solution queries
- comparison/review queries
- creator/shadow-account discovery queries
- community discovery queries

Example:

```txt
Product: AI distribution tool for technical founders
Queries:
- "AI content tool for founders"
- "technical founders marketing distribution problem"
- site:x.com "distribution experiments" founder SaaS
- site:linkedin.com SaaS founder content strategy
- site:reddit.com indie hackers marketing pain
- "AutoScale alternative" once product has competitors
```

### 2. Discovery Adapters

Adapters should be isolated. Do not hardwire search logic into TrendWatch.

Initial adapters:

```txt
services/scraping/adapters/web-search.ts
services/scraping/adapters/site-search.ts
services/scraping/adapters/manual-seed.ts
```

Later adapters:

```txt
services/scraping/adapters/tiktok.ts
services/scraping/adapters/x.ts
services/scraping/adapters/linkedin.ts
services/scraping/adapters/youtube.ts
services/scraping/adapters/reddit.ts
services/scraping/adapters/product-hunt.ts
services/scraping/adapters/g2-capterra.ts
```

Hard rule: adapters must say what they can and cannot verify.

### 3. Source Candidate Normalizer

Every discovered item should become a `SourceCandidate` before insertion.

```ts
type SourceCandidate = {
  url: string | null;
  platform: string;
  title?: string | null;
  snippet?: string | null;
  account_handle?: string | null;
  account_type?: "official" | "competitor" | "shadow" | "creator" | "partner" | "affiliate" | "review" | "unknown";
  discovery_query: string;
  discovery_adapter: string;
  reason: string;
  confidence_score: number;
};
```

Deduplicate by canonical URL, platform + handle, and near-identical titles/snippets.

### 4. Safe Fetch + Evidence Extraction

Use the existing safe fetch discipline:

- HTTP/HTTPS only
- reject private/loopback IPs
- timeout aggressively
- limit body size
- do not bypass login walls, CAPTCHAs, paywalls, or platform restrictions
- store fetch status and error reason

The system must never pretend it read a source it could not fetch.

### 5. Source Classification

Every source should be classified into:

- account type
- platform
- content format
- hook pattern
- angle
- CTA pattern
- audience pain
- visual pattern when verifiable
- why it worked
- how to adapt
- distortion risk
- transferability score
- confidence score

This already exists partly in `services/trendwatch/classify-source.ts`. The next step is to feed it discovered sources automatically.

### 6. Signal Scoring

The scoring model should prioritize useful signals over vanity metrics.

High-value signals:

- saves
- shares
- comments with buying intent
- repeated format across multiple accounts
- recent performance
- relevance to target audience
- transferability to this founder's product
- low celebrity/follower distortion

Weak signals:

- likes alone
- celebrity virality
- generic motivational content
- unverifiable performance claims
- old posts with unclear context

### 7. Pattern Miner

This is where the AI should think deeply.

Input: enriched source set.

Output:

- competitor format fingerprints
- repeated hooks
- emotional triggers
- offer patterns
- CTA patterns
- demo structures
- visual patterns
- audience pain language
- objections
- white-space opportunities
- recommended experiments

The Pattern Miner should not output random strategy prose. It should output structured JSON.

### 8. Market Source Map

The Scraping Engine should create a Market Source Map before TrendWatch.

```txt
Direct competitors
Indirect competitors
Audience magnets
Shadow accounts
Review/comparison sources
Communities
Search-intent sources
High-transferability post examples
Low-confidence/unverified candidates
```

This lets the founder see what AutoScale actually found.

## Database direction

Current tables already cover some of this:

- `trendwatch_sources`
- `trendwatch_runs`
- `trendwatch_insights`
- `competitors`
- `competitor_accounts`

Next migration should consider adding discovery metadata to `trendwatch_sources`:

```sql
alter table public.trendwatch_sources
  add column if not exists discovery_query text,
  add column if not exists discovery_adapter text,
  add column if not exists discovery_reason text,
  add column if not exists discovered_at timestamptz,
  add column if not exists canonical_url text,
  add column if not exists source_quality_score numeric not null default 0;
```

Do not create ten new tables yet. Extend the existing source chain first.

## API direction

Recommended routes/actions:

```txt
POST /api/projects/:id/scraping/plan
POST /api/projects/:id/scraping/discover
POST /api/projects/:id/scraping/enrich
POST /api/projects/:id/scraping/run
```

For now, a server action can be enough. Do not overbuild API surface until the engine works.

## UI direction

Add a Scraping Engine screen between Brief and TrendWatch:

```txt
/projects/[id]/scraping
```

Sections:

1. Discovery Plan
2. Source Candidates
3. Verified / Fetched Sources
4. Low-Confidence Sources
5. Competitor Format Fingerprints
6. Market White Space
7. Send to TrendWatch

The user should be able to approve, reject, or add sources manually.

## Confidence rules

Use explicit confidence:

```txt
High: source was discovered, fetched, classified, and has strong relevance/signals.
Medium: source was discovered and partially verified, but metrics/context are incomplete.
Low: source is a candidate only, or source fetch failed, or performance is unverifiable.
Unknown: no reliable evidence.
```

The engine must use labels like:

```txt
verified source
candidate source
unverified source
fetch failed
manual note only
```

## What not to build yet

Do not build these first:

- full browser automation
- headless TikTok scraping hacks
- fake social API integrations
- login-required scraping
- huge analytics dashboards
- autonomous posting
- revenue attribution before source intelligence works

Build the evidence engine first.

## Success criteria

The Scraping Engine is useful when a founder can say:

```txt
I pasted my URL.
AutoScale understood my product.
It found the accounts, competitors, posts, patterns, hooks, and white spaces I should study.
It explained what competitors are doing and what seems to be working.
It turned those findings into experiments I can run.
```

That is the current product focus.
