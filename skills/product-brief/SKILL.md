# Product Brief Skill

## Purpose

Turn a startup or product URL into a structured, editable Product Brief.

This skill is the first context layer. It must not generate full TrendWatch reports, scripts, schedules, experiments, analytics, or weekly plans.

Its job is:

```txt
URL -> product understanding -> validated editable brief -> saved source of truth -> Scraping Engine seed context
```

## Hard Rules

1. Do not invent facts that are not supported by the website or founder-provided context.
2. Use confidence scores when guessing.
3. Return structured JSON only.
4. Separate extracted product facts from strategic guesses.
5. If the website is unreadable, request or use fallback homepage copy/product description.
6. Competitors are seed guesses unless directly found on the site.
7. Suggested sources are seed candidates, not verified research.
8. The saved Product Brief becomes the source of truth for future AutoScale agents.
9. Keep Product Brief narrow. Deep competitor/source discovery belongs to the Scraping Engine.

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
9. Hand off to the Scraping Engine with seed competitors, source suggestions, platform recommendations, pain points, and market category.

## Required Output

Return an `AutoBrief` JSON object matching `services/autobrief/schema.ts`.

The brief must include:

- Product identity: name, URL, one-line description, category/niche, product type
- Product understanding: what it does, audience, problem, promise, features, benefits
- Market guess: competitors, alternatives, market category, audience pain points
- Distribution context: content angles, platform recommendations, CTAs, founder-led opportunities, positioning gaps
- Discovery seed context: likely competitors, suggested sources, platform recommendations, alternative solutions, pain/search language
- Confidence: overall, audience, features, competitors, positioning
- Notes: missing information and extraction notes

## Scraping Engine handoff

The Product Brief should help the Scraping Engine generate a discovery plan.

Useful seed fields:

```txt
product_name
product_url
category
niche
target_customer
primary_pain
user_pain_points
core_promise
alternative_solutions
market_category
suggested_competitors
suggested_sources
platform_recommendations
positioning_angles
content_pillars
```

Do not overstate the handoff. These are inputs for research, not final intelligence.

## Quality Bar

A successful Product Brief output should make the founder think:

```txt
Okay, this understands my product well enough to start competitor/source discovery.
```

If the brief feels generic, overconfident, or detached from the website, it fails.
