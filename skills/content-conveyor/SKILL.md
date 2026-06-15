# Skill: Content Conveyor

## Purpose

Convert TrendWatch insights into structured content drafts. Every output is linked to a TrendWatch insight (or explicitly flagged when not), has a hypothesis, and names a metric to watch.

## Inputs

- Project + brief context
- TrendWatch insights (with hook patterns + winning formats)
- Hooks (from `hooks` table) — generated first
- Optional production constraints from `product_briefs.production_constraints`

## Workflow

1. **Hooks** — `generateHooks()` produces 24+ hooks anchored to TrendWatch insights and saves them with `insight_id` set.
2. **Content ideas** — `generateContentIdeas()` produces 12+ structured ideas, each referencing a hook + a hypothesis + a metric_to_watch.
3. **Post drafts** — `generatePostDraft()` runs once per accepted idea, producing slides + caption + CTA.
4. Every draft passes through `runDeterministicQualityChecks()` (Quality Gate) before status becomes `in_review`.
5. Persist into `hooks`, `content_ideas`, `generated_posts`, `post_slides`.

## Output schemas

See `services/content-conveyor/schema.ts`:

- `HooksSchema`
- `ContentIdeasSchema`
- `GeneratedPostSchema`

## Quality rules

- Every hook is under 14 words. No emojis. No "Discover/Unlock/Imagine".
- Every content idea includes `format`, `hook`, `hypothesis`, `metric_to_watch`, `platforms`, `risk_level`.
- Every post draft includes 3–8 slides for carousels (5–7 is the sweet spot).
- Caption length 40–90 words.
- CTA is one short line.
- Reject if the format requires production the founder can't realistically do.

## Failure cases

- AI output fails schema → retry once.
- Duplicate hook detected (same hook string already exists for the project) → mark as `revise` in Quality Gate.
- Carousel with <3 slides → fail Quality Gate.

## Formats supported (V1)

- problem-solution carousel
- tool teardown carousel
- before/after workflow carousel
- mistake carousel
- comparison carousel
- checklist carousel
- founder-led short script
- X thread / LinkedIn text post

## Examples

See `services/ai/adapters/mock.ts` for canonical example outputs used in dev.
