# Skill: Compound Engine

## Purpose

Turn winners into more winners. Diagnose why a post won, generate distinct variants, build next week's plan, and write durable learnings into project memory.

## Inputs

- A winning experiment (hook, format, angle, audience, CTA, metrics, founder notes)
- Project context (niche, brief, prior learnings)

## Workflow

1. `diagnoseWinner()` — produces structured `WinnerDiagnosis` (services/compound/schema.ts).
2. Persist into `winners` table with `winning_reason`, `winning_elements`, `recommended_next_actions`.
3. Write `learning_to_store` into `learnings` (with `category = "winner"`, `source_winner_id` reference).
4. `generateVariants()` — produces 10 distinct variants (different angle / audience / framing).
5. Persist into `variants` table with `status = "idea"`.
6. Mark source experiment as `status = "variant_created"`.

## Output schemas

See `services/compound/schema.ts`:

- `WinnerDiagnosisSchema`
- `VariantsSchema`

## Quality rules

- Variants must diverge meaningfully. Don't just paraphrase the winning hook.
- Each variant shifts at least one major lever: angle, audience, format, or framing.
- Learnings should be 1–2 sentences and durable — useful across multiple future runs.
- `winning_reason` must connect cause to measurable effect ("save rate 3.4× project median because the slide-1 pain hook isolated the post-launch founder moment").

## Killer actions (V1)

- Mark winner → automatic diagnosis + 10 variants.
- Future: convert variant → drafted post (one click).
- Future: build next week's plan from top 3 winners + 5 variants each.
- Future: kill weak angle → adds entry to `learnings` with `category = "kill"`.

## Failure cases

- AI output fails schema → retry once.
- After failure, still record `winners` row but skip variants and log to `ai_runs`.

## Example diagnosis

```json
{
  "winning_reason": "Pain-first hook + transferable carousel structure resonated with post-launch founders. Save rate was 3.4× project average.",
  "winning_elements": {
    "hook": "You built the app. Nobody cares yet.",
    "format": "problem-solution carousel",
    "angle": "Distribution is the new bottleneck",
    "audience": "Solo technical founders post-launch",
    "cta": "Run TrendWatch on your startup",
    "visual_style": "Bold headline, no AI imagery"
  },
  "learning_to_store": "Pain-first hooks for post-launch founders drive 3×+ save rates. Keep slide-1 stark."
}
```
