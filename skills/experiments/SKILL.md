# Skill: Experiments

## Purpose

Turn every generated/scheduled post into a measurable experiment. Track raw metrics, founder notes, and lifecycle status. Feed winners into the Compound Engine.

## Inputs

- A generated post (and optionally a scheduled post)
- Manual metric entry from the founder
- Optionally: future automatic import from Postiz / platform APIs (V2)

## Workflow

1. Every scheduled post auto-creates an experiment row (`status = approved`).
2. Founder posts manually or via Postiz → status becomes `posted`.
3. Founder enters metrics in `/projects/[id]/experiments` → status becomes `measured`.
4. Founder marks `winner`, `neutral`, `loser`, or `killed`.
5. Winners unlock the Compound Engine.

## Tracked fields

- views, saves, shares, comments, clicks, signups, purchases, revenue (numeric)
- notes (free-form founder text)
- status (lifecycle)

## Lifecycle statuses

```txt
draft → approved → exported → posted → measured →
  winner | neutral | loser | killed | variant_created
```

## Quality rules

- Don't overcomplicate attribution early. UTM links + promo codes + manual notes are enough.
- A "winner" requires real evidence (typically save rate ≥ 2× project median OR signups > 0 OR revenue > 0).
- Killing a pattern should require founder note explaining why.

## Future

- Auto-import metrics from Postiz / native platform APIs (V2).
- Cohort comparison views (V2.1).
- Automatic winner candidates surfacing via thresholds (V2.1).
