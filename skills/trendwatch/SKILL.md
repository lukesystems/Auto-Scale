# Skill: TrendWatch

## Purpose

Reverse-engineer what already works in the founder's niche. Produce a structured analysis of competitors, shadow accounts, winning formats, hook opportunities, recommended experiments, and risk flags — all anchored to real sources, not generic marketing fluff.

## Inputs

- Project name + niche
- Product summary, target customer, primary pain (from product brief)
- Competitor list (from `competitors` table)
- Source posts (from `trendwatch_sources` table): URLs, platforms, handles, account types, optional metrics, notes

## Workflow

1. Pull project + brief + competitors + sources.
2. Call `runTrendWatchAnalysis()` in `services/trendwatch/generate.ts`.
3. Validate with `TrendWatchAnalysisSchema`.
4. Score each "winning format" and "hook opportunity" using `calculateSignalScore()` (`services/trendwatch/scoring.ts`).
5. Persist as `trendwatch_insights` rows tied to the run.
6. Update `trendwatch_runs` with status, counts, niche_summary.

## Output schema

See `services/trendwatch/schema.ts`:

- `niche_summary` — 2-4 sentences
- `competitor_map` — array of `{ name, strength, weakness, account_type }`
- `shadow_account_targets` — 3-6 strings
- `winning_formats` — array of `{ format, reason }`
- `hook_opportunities` — 6-12 strings
- `recommended_experiments` — 3-6 strings
- `risk_flags` — 2-5 strings

## Signal scoring weights (V1)

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
- Prefer transferable patterns over celebrity-creator content.
- Flag follower distortion explicitly via `estimateDistortionRisk()`.
- Tag formats specifically ("problem-solution carousel", not "engaging post").
- Hook opportunities must be one sharp sentence, no emojis.

## Failure cases

- No sources + no niche → still run, but ground analysis with a caveat in `niche_summary`.
- AI output fails schema → retry once.
- After failure, mark `trendwatch_runs.status = 'failed'` with the error in `notes`.

## Memory accumulation

Every TrendWatch run appends to project memory. Future runs should:

- Reference winners from previous runs (via `winners` + `learnings` tables).
- De-prioritize patterns flagged as "killed" by the compound engine.
- Sharpen hook opportunities based on what actually drove saves in prior experiments.
