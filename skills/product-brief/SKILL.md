# Skill: Product Brief Engine

## Purpose

Turn a founder's product URL and a handful of inputs into a structured growth brief that anchors every downstream AutoScale module (TrendWatch, Content Conveyor, Quality Gate, Compound Engine).

## Inputs

- Product name (required)
- Product URL
- Description (1-2 sentences)
- Target audience
- Competitors (list)
- Offer
- Preferred CTA
- Brand tone
- Preferred platforms
- Production preference (faceless, founder-led, UGC, demo-based, etc.)

## Workflow

1. Gather inputs from the project record + product_briefs row.
2. Send to `generateProductBrief()` (services/product-brief/generate.ts).
3. Validate with `ProductBriefSchema` (Zod).
4. Upsert into `product_briefs` keyed by `project_id`.
5. Log to `ai_runs` with kind `product_brief`.

## Output schema

See `services/product-brief/schema.ts`. Required fields:

- `product_summary` — 1-sentence summary
- `target_customer` — specific ICP
- `primary_pain` — most acute pain
- `core_promise` — transformation in one line
- `offer` — what + price
- `cta` — short, actionable
- `competitors` — array
- `content_pillars` — 3-6 themes
- `positioning_angles` — 3-5 angles
- `production_constraints` — object with platform + capability booleans
- `brand_voice` — one paragraph

## Quality rules

- Never produce generic marketing language ("revolutionize", "unleash", "transform").
- Always anchor each line to the founder's product + ICP.
- If inputs are sparse, ask for more — don't invent specifics.

## Failure cases

- Empty product name → reject before AI call.
- AI output fails schema → retry once (built into `generateObject`).
- After retry, fall back to keeping whatever fields the founder already filled in.

## Example

```json
{
  "product_summary": "AI-powered tool that turns proven content patterns into weekly growth experiments for technical founders.",
  "target_customer": "Solo and early-stage technical founders who can build but struggle with distribution.",
  "primary_pain": "Building is easy. Getting users is hard. Founders don't know what to post, when, or why.",
  "core_promise": "Reverse-engineer your niche, ship structured content experiments, and compound winners — without hiring marketing.",
  "offer": "$149/month for the full growth loop.",
  "cta": "Build my growth engine",
  "content_pillars": ["Founder distribution lessons", "Niche reverse-engineering", "Content experiment teardowns"],
  "positioning_angles": ["You built the app. Nobody cares yet.", "Stop guessing what to post.", "Distribution is the new bottleneck."],
  "production_constraints": {
    "can_make_carousels": true,
    "can_make_founder_videos": false,
    "can_use_product_screenshots": true,
    "can_use_ai_images": true,
    "preferred_platforms": ["x", "linkedin", "tiktok"]
  },
  "brand_voice": "Direct, technical, slightly contrarian. No hype. No fluff."
}
```
