# Product Brief Skill

## Purpose

Turn a startup or product URL into a structured, editable Product Brief.

This skill is Loop 1. It must not generate TrendWatch reports, hooks, scripts, schedules, experiments, analytics, or weekly plans.

Its only job is:

```txt
URL -> product understanding -> validated editable brief -> saved source of truth
```

## Hard Rules

1. Do not invent facts that are not supported by the website or founder-provided context.
2. Use confidence scores when guessing.
3. Return structured JSON only.
4. Separate extracted product facts from strategic guesses.
5. If the website is unreadable, request or use fallback homepage copy/product description.
6. Competitors are guesses unless directly found on the site.
7. The saved Product Brief becomes the source of truth for future AutoScale agents.
8. Keep Loop 1 narrow. Product understanding comes before TrendWatch.

## Runtime Workflow

1. Accept a single product URL, with optional advanced/manual context hidden by default.
2. Validate and safely fetch the website.
3. Extract useful website content: title, meta description, headings, body copy, visible CTAs, and product/pricing/feature claims.
4. Clean obvious junk such as nav repetition, cookie banners, legal/footer text, and repeated menu items.
5. Generate a Product Brief JSON object with `generateAutoBrief()`.
6. Validate the result with `AutoBriefSchema`.
7. Show an editable brief grouped into:
   - Product Summary
   - Audience
   - Problem + Promise
   - Features + Benefits
   - Market + Competitors
   - Distribution Context
   - Confidence Notes
8. Save the confirmed brief to `product_briefs` and create/update the project context.

## Required Output

Return an `AutoBrief` JSON object matching `services/autobrief/schema.ts`.

The brief must include:

- Product identity: name, URL, one-line description, category/niche, product type
- Product understanding: what it does, audience, problem, promise, features, benefits
- Market guess: competitors, alternatives, market category, audience pain points
- Distribution context: content angles, platform recommendations, CTAs, founder-led opportunities, positioning gaps
- Confidence: overall, audience, features, competitors, positioning
- Notes: missing information and extraction notes

## Quality Bar

A successful Loop 1 output should make the founder think:

```txt
Okay, this understands my product.
```

If the brief feels generic, overconfident, or detached from the website, it fails Loop 1.
