# Loop 1: URL → Product Brief → Scraping Engine Handoff

## Current status

Loop 1 is no longer just a design idea. The codebase now has a real AutoBrief foundation:

```txt
Product URL
→ safe product-site fetch
→ structured AutoBrief generation
→ editable review
→ saved Product Brief
→ project source of truth
```

That foundation is correct, but the next direction is sharper:

```txt
Product Brief
→ Scraping Engine
→ TrendWatch competitor/source intelligence
→ experiment generation
```

## Updated product thesis

AutoScale should not be a generic content generator.

AutoScale should become the system that:

```txt
understands a founder's product,
finds public competitor/source evidence,
reverse-engineers working patterns,
turns those patterns into experiments,
tracks what happened,
and compounds the messages that produce results.
```

## Loop 1 responsibility

Loop 1 still has one job:

```txt
Make AutoScale understand the product.
```

The founder experience:

1. Founder pastes a product/startup URL.
2. AutoScale safely reads the site.
3. AutoScale extracts useful product copy.
4. AutoScale generates a structured Product Brief.
5. Founder reviews/edits the brief.
6. AutoScale saves the brief as the project source of truth.
7. AutoScale uses the brief to seed the Scraping Engine.

## Product Brief fields

The generated Product Brief should include:

### Product Identity

- Product name
- Website URL
- One-line description
- Category / niche
- Product type

### Product Understanding

- What the product does
- Who it is for
- Main problem it solves
- Core promise
- Key features
- Key benefits

### Market Guess

- Target audience guess
- User pain points
- Likely competitors
- Alternative solutions
- Market category

### Distribution Context

- Best content angles
- Likely winning platforms
- Suggested CTA options
- Founder-led content opportunities
- Positioning gaps

### Scraping Engine Seed Context

- Suggested competitors
- Suggested source URLs/platforms
- Platform recommendations
- Pain/problem keywords
- Alternative-solution keywords
- Audience language
- Positioning angles
- Content pillars

### Confidence + Notes

Each major section should have confidence:

```txt
High confidence
Medium confidence
Low confidence
```

If a competitor or source is only inferred, label it clearly as a guess.

## Current technical expectation

Loop 1 should work reliably as:

```txt
URL
→ safe fetch
→ extracted website content
→ AutoBrief JSON
→ editable brief
→ saved Product Brief
→ seed competitors/sources
```

## What the next build adds

The next build is the **Scraping Engine**.

Its job:

```txt
Saved Product Brief
→ discovery query plan
→ source candidates
→ safe source enrichment
→ source classification
→ signal scoring
→ pattern mining
→ TrendWatch-ready evidence
```

See `docs/SCRAPING_ENGINE.md`.

## Scraping Engine expectations

The engine should discover and organize:

1. Direct competitors
2. Indirect competitors
3. Audience magnets
4. Creator/shadow accounts
5. Review/comparison pages
6. Communities where the audience discusses the pain
7. Source posts with useful hooks, formats, CTAs, or comments
8. Search-intent pages that reveal active demand

The output should be:

- Market Source Map
- Competitor Format Fingerprints
- Hook/angle patterns
- CTA patterns
- Audience pain language
- Market white space
- Recommended experiments
- Risk/confidence notes

Not this:

```txt
Here are random viral posts.
```

That is shallow and not enough.

## Updated build order

### Phase 1 — AutoBrief foundation

Already the foundation in the current codebase.

Required pieces:

- URL validation
- safe website fetch
- page extraction
- content cleaning
- structured AutoBrief JSON
- editable review
- Supabase save
- fallback manual entry

### Phase 2 — Scraping Engine foundation

Build next:

- discovery query planner
- source candidate schema
- adapter interface
- manual seed adapter
- web/search adapter
- source candidate deduplication
- source enrichment using existing safe fetch
- source classification using existing classification logic
- source confidence and signal scoring
- Scraping Engine UI screen

### Phase 3 — Pattern Miner

Then add:

- competitor format fingerprints
- repeated hook extraction
- CTA pattern extraction
- pain-language extraction
- white-space finder
- experiment recommendations

### Phase 4 — TrendWatch upgrade

TrendWatch should consume the enriched source map instead of relying mostly on manually entered sources.

### Phase 5 — Experiment Pack

Generate:

- campaign hypotheses
- hooks
- scripts/posts
- metric to watch
- expected audience reaction
- source reference for every idea

## What not to build yet

Do not build these before the Scraping Engine works:

- revenue attribution
- website pixel
- payment webhooks
- advanced analytics dashboards
- full autonomous posting
- complex agency/operator mode
- heavy media generation

Those matter later. The current moat is source discovery + competitor intelligence.

## Hard rules

1. No source, no strong claim.
2. Never invent competitor metrics.
3. Never claim a source was verified if fetch failed.
4. Label low-confidence insights.
5. Store source evidence before generating strategy.
6. Keep source → insight → post → experiment traceability.
7. AutoBrief is context. Scraping Engine is discovery. TrendWatch is reasoning.

## Success criteria

Loop 1 + Scraping Engine succeeds when the founder thinks:

```txt
I pasted my URL.
It understood my product.
It found relevant competitors, sources, accounts, and patterns.
It explained what seems to be working in my market.
It gave me experiments I would not have thought of myself.
```

That is the product direction now.
