# Skill: TrendWatch

## Purpose

TrendWatch reverse-engineers what already works in the founder's niche and converts sourced market evidence into structured growth intelligence.

It should produce a structured analysis of competitors, shadow accounts, winning formats, hook opportunities, recommended experiments, and risk flags — all anchored to real sources, not generic marketing fluff.

## Current position in the product

TrendWatch is no longer the first research step.

The expected flow is now:

```txt
Product Brief
→ Scraping Engine discovers/enriches sources
→ TrendWatch analyzes those sources
→ Content Conveyor creates experiments
```

TrendWatch should reason from enriched sources. If no sources exist, it may still run, but it must label the result low-confidence.

## Inputs

- Project name + niche
- Product summary, target customer, primary pain from the Product Brief
- Competitor list from `competitors`
- Enriched source posts/pages from `trendwatch_sources`
- Source metadata: platform, handle, account type, URL, fetch status, fetched text, metrics, confidence, signal score, scoring reasons
- Future Scraping Engine metadata: discovery query, discovery adapter, discovery reason, canonical URL, source quality score

## Workflow

1. Pull project + Product Brief + competitors + sources.
2. Enrich pending source URLs where needed.
3. Classify each source by account type, format, hook, angle, CTA pattern, audience pain, distortion risk, and transferability.
4. Aggregate source confidence.
5. Call `runTrendWatchAnalysis()` in `services/trendwatch/generate.ts`.
6. Validate with `TrendWatchAnalysisSchema`.
7. Persist insights as `trendwatch_insights` rows tied to the run.
8. Store confidence and scoring reasons.
9. Update `trendwatch_runs` with status, counts, and niche summary.

## Output schema

See `services/trendwatch/schema.ts`:

- `niche_summary` — 2-4 sentences
- `competitor_map` — array of `{ name, strength, weakness, account_type }`
- `shadow_account_targets` — 3-6 strings
- `winning_formats` — array of `{ format, reason }`
- `hook_opportunities` — 6-12 strings
- `recommended_experiments` — 3-6 strings
- `risk_flags` — 2-5 strings

## What TrendWatch should identify

TrendWatch should extract:

- competitor format fingerprints
- repeated hook patterns
- repeated audience pain language
- CTA patterns
- demo structures
- visual patterns when supported by source evidence
- market white space
- weak competitor positioning
- high-transferability formats
- low-confidence traps
- follower/celebrity distortion
- experiments the founder can run next

## Signal scoring weights

Current signal logic prioritizes practical growth evidence:

```txt
score =
  relevance              * 0.30
+ format_transferability * 0.25
+ save_signal            * 0.20
+ recency                * 0.10
+ conversion_intent      * 0.10
+ account_fit            * 0.05
```

## Quality rules

- Never invent fake metrics or made-up creators.
- Never claim a competitor strategy is verified unless there is source evidence.
- Prefer transferable patterns over celebrity-creator content.
- Flag follower distortion explicitly via `estimateDistortionRisk()`.
- Tag formats specifically: use `problem-solution carousel`, not `engaging post`.
- Hook opportunities must be sharp, specific, and tied to the niche.
- Separate evidence from strategic inference.
- If sources are weak, say the analysis is weak.

## Failure cases

- No sources + no niche → run only with a strong low-confidence caveat.
- Source fetch failed → do not treat metrics or content as verified.
- AI output fails schema → retry once through the runtime.
- After failure, mark `trendwatch_runs.status = 'failed'` with the error in `notes`.

## Memory accumulation

Every TrendWatch run appends to project memory. Future runs should:

- Reference winners from previous runs through `winners` and `learnings`.
- De-prioritize patterns flagged as killed by the Compound Engine.
- Sharpen hook opportunities based on what drove saves, clicks, signups, purchases, or revenue in prior experiments.

## Success criteria

TrendWatch succeeds when it tells the founder:

```txt
Here is what competitors and adjacent accounts seem to be doing.
Here are the patterns that appear transferable.
Here are the experiments worth running.
Here is what is weak, risky, or low-confidence.
```

It fails if it becomes a generic marketing report.
