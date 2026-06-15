# Skill: Quality Gate

## Purpose

Reject weak, generic, risky, duplicated, or off-brand content before it reaches the approval queue or export pack. Protects brand trust, platform safety, and the source → insight → post chain.

## Inputs

- A generated post (hook, caption, cta, slides, hypothesis, metric_to_watch, format)
- Insight linkage flag (whether the post is tied to a TrendWatch insight)
- Existing hooks in the project (for duplicate detection)

## Workflow

1. Run `runDeterministicQualityChecks()` from `services/quality-gate/check.ts`.
2. Compute failures, fixes, risks, score (0–1).
3. Decide status: `pass` ≥ 0.75, `revise` ≥ 0.5, `fail` < 0.5.
4. Persist `quality_score`, `quality_status`, `quality_reasons` into `generated_posts`.
5. Set post `status` to `in_review` if pass, otherwise `draft`.

## Output schema

```ts
{
  status: "pass" | "revise" | "fail",
  score: number,                  // 0..1
  failure_reasons: string[],
  fix_instructions: string[],
  risk_flags: string[],
  approved_for_export: boolean,
}
```

## Checks (V1)

- Insight linkage present? (-0.4 if not)
- Hook present and ≤ 18 words?
- Hypothesis present? (-0.1 if missing)
- Metric to watch present?
- CTA present?
- Caption length sane?
- Duplicate hook?
- Over-promise terms (guaranteed, viral overnight, secret hack, millionaire, etc.)
- Carousel slide count between 3 and 12

## Future (post-V1)

- LLM-as-judge pass for tone/voice alignment.
- Platform-specific safe-zone checks for visual assets.
- Spam similarity against project history.
- Brand voice embedding comparison.

## Failure cases

- Quality Gate itself throws → fail safe: mark as `draft` with `quality_reasons = ["Quality Gate error: ..."]`.

## Example

```json
{
  "status": "pass",
  "score": 0.87,
  "failure_reasons": [],
  "fix_instructions": [],
  "risk_flags": ["No CTA — direct conversion will be weak."],
  "approved_for_export": true
}
```
