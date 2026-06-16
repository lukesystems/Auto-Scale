Loop 1 should be brutally narrow:

# Loop 1: URL → Editable Product Brief

At the end of Loop 1, AutoScale should do **one thing extremely well**:

> Founder pastes a URL. AutoScale studies it, generates a credible product brief, lets the founder edit it, then saves it as the source of truth for everything else.

Not TrendWatch yet. Not scripts yet. Not scheduling yet.

Just: **understand the product.**

---

# What should work at the end of Loop 1

## 1. URL-only onboarding

Main screen:

> **Paste your startup/product URL**

Button:

> **Generate Product Brief**

That is it.

No long form. No required fields. No “tell us about your audience.” No “choose platforms.” Hide all that.

The user flow:

1. User pastes URL.
2. AutoScale fetches the site.
3. AutoScale extracts useful content.
4. AutoScale generates structured product understanding.
5. User sees an editable brief.
6. User confirms or edits.
7. AutoScale saves the brief.
8. User can continue to Loop 2: **Generate TrendWatch Report**.

---

# 2. The generated Product Brief should include these fields

This is the minimum useful version:

## Product Identity

* Product name
* Website URL
* One-line description
* Category / niche
* Product type: SaaS, app, agency, marketplace, tool, course, community, etc.

## Product Understanding

* What the product does
* Who it is for
* Main problem it solves
* Core promise
* Key features
* Main benefits

## Market Guess

* Target audience guess
* User pain points
* Likely competitors
* Alternative solutions users already use
* Market category

## Distribution Context

* Best content angles
* Likely winning platforms
* Suggested CTA options
* Founder-led content opportunities
* Positioning gaps

## Confidence + Notes

This is important.

Each major section should have a confidence level:

* High confidence
* Medium confidence
* Low confidence

Example:

> Target audience: Technical founders and indie hackers
> Confidence: Medium
> Reason: Website language mentions founders, launch, growth, and SaaS, but no explicit ICP page was found.

This prevents AutoScale from hallucinating like a clown.

---

# 3. The Product Brief should be editable

Do not make the generated brief static.

The founder must be able to edit:

* audience
* product summary
* competitor guesses
* CTA
* positioning
* niche
* tone
* content goals

Because the AI will sometimes be wrong.

The UI should make it feel like:

> “AutoScale gave me a strong first draft. I just need to correct small parts.”

Not:

> “This AI guessed random nonsense and now I have to fix everything.”

---

# 4. Product Brief becomes the source of truth

Once the user clicks:

> **Save Brief**

That brief becomes the base context for:

* TrendWatch
* hook generation
* scripts
* content queue
* experiment analysis
* weekly plans

This matters because AutoScale needs memory.

Every project should have:

```ts
Project
  id
  userId
  url
  productBriefId
  createdAt
  updatedAt
```

And:

```ts
ProductBrief
  id
  projectId
  sourceUrl
  productName
  category
  oneLineDescription
  targetAudience
  problemSolved
  corePromise
  keyFeatures
  keyBenefits
  competitors
  contentAngles
  platformRecommendations
  ctaSuggestions
  positioningGaps
  confidenceScores
  rawExtractedText
  createdAt
  updatedAt
```

Do not overcomplicate it yet.

---

# The real MVP pipeline

Build Loop 1 as this pipeline:

## Step 1: Accept URL

Validate:

* Is it a proper URL?
* Is it reachable?
* Does it return useful content?
* Is it not obviously blocked?

If the URL fails, show:

> “We couldn’t read this page properly. Paste your homepage copy or product description instead.”

That fallback is mandatory. Website scraping fails often.

---

## Step 2: Extract website content

For MVP, extract:

* page title
* meta description
* headings
* body text
* pricing text if visible
* feature sections
* CTA buttons
* nav links
* footer links

You do **not** need full browser automation yet.

Do not scrape 100 pages. That is bloat.

MVP crawl limit:

* homepage
* pricing page if found
* features page if found
* about page if found

Maximum: **3–5 pages.**

That is enough for Loop 1.

---

## Step 3: Clean the extracted content

Remove:

* nav repetition
* cookie banners
* footer junk
* social links
* legal text
* repeated menu items

Keep:

* headings
* hero copy
* feature copy
* pricing claims
* benefits
* testimonials
* CTAs

Bad input creates bad briefs. Content cleaning matters.

---

## Step 4: Generate structured JSON

The AI should not return free-form text.

It should return validated JSON.

Example output shape:

```json
{
  "productName": "AutoScale",
  "oneLineDescription": "An AI distribution workspace that helps founders turn a product URL into market research, hooks, scripts, and growth experiments.",
  "category": "AI growth software",
  "targetAudience": [
    "technical founders",
    "indie hackers",
    "early-stage SaaS builders"
  ],
  "problemSolved": "Founders can build products but struggle to understand what content works and how to distribute consistently.",
  "corePromise": "Paste your product URL and get a weekly distribution system.",
  "keyFeatures": [
    "URL-based product brief generation",
    "TrendWatch reports",
    "hook and script generation",
    "content queue",
    "experiment tracking"
  ],
  "competitorGuesses": [
    {
      "name": "Taplio",
      "reason": "LinkedIn content and growth workflow overlap",
      "confidence": "low"
    }
  ],
  "contentAngles": [
    "Founder building in public",
    "Distribution lessons",
    "Before/after product positioning",
    "Market teardown content"
  ],
  "platformRecommendations": [
    {
      "platform": "X",
      "reason": "Strong founder and indie hacker audience"
    },
    {
      "platform": "LinkedIn",
      "reason": "B2B SaaS and founder audience"
    }
  ],
  "ctaSuggestions": [
    "Paste your startup URL and get your first TrendWatch report",
    "Turn your product into weekly content experiments"
  ],
  "positioningGaps": [
    "Needs sharper proof that it improves distribution outcomes, not just generates content"
  ],
  "confidence": {
    "overall": "medium",
    "audience": "medium",
    "competitors": "low",
    "features": "high"
  }
}
```

This makes the app programmable.

---

# What the UI should look like

## Screen 1: URL Input

Headline:

> **Paste your product URL. Generate your growth brief.**

Input:

> `https://yourstartup.com`

Button:

> **Generate Brief**

Small text:

> AutoScale will read your website, identify your audience, positioning, content angles, and distribution opportunities.

---

## Screen 2: Loading State

Do not show boring spinner only.

Show agent steps:

* Reading website
* Extracting product details
* Identifying audience
* Mapping niche
* Finding content angles
* Preparing editable brief

This makes the product feel alive.

---

## Screen 3: Product Brief Editor

Sections:

1. Product Summary
2. Audience
3. Problem + Promise
4. Features + Benefits
5. Market + Competitors
6. Content Angles
7. Platform Recommendations
8. CTA Suggestions
9. Positioning Gaps

Buttons:

* **Save Brief**
* **Regenerate**
* **Edit Advanced Context**
* **Generate TrendWatch Report**

---

# What not to build in Loop 1

Do **not** build these yet:

* real competitor research
* full market research
* social scraping
* content generation
* scheduler
* analytics
* team accounts
* billing complexity
* model marketplace
* browser agent automation
* Chrome extension

Those belong later.

Loop 1 is not research. It is **product understanding.**

---

# The key technical expectation

At the end of Loop 1, this should work reliably:

```txt
URL → Extracted Website Content → AI Product Brief JSON → Editable Brief → Saved Project Context
```

That is the whole loop.

If that works, AutoScale has a foundation.

If that does not work, everything after it becomes garbage.

---

# Success criteria for Loop 1

Loop 1 is successful if:

1. A user can paste a URL and get a useful brief.
2. The brief is structured, not random text.
3. The user can edit every important field.
4. The brief saves to the database.
5. The saved brief can be reused by Loop 2.
6. The system handles failed scraping with a manual fallback.
7. The output feels accurate enough that the user thinks:
   **“Okay, this understands my product.”**

That last one is the activation trigger.

---

# My hard take

Do not start with TrendWatch.

Start with **Product Brief Agent** and make it excellent.

Because AutoScale’s quality ceiling depends on the brief.

Weak brief = weak TrendWatch = weak hooks = weak content = user churn.

Loop 1 should feel magical, but underneath it should be controlled, structured, editable, and confidence-scored.

Build this first:

> **Paste URL → AutoScale understands your product → editable source-of-truth brief.**

That is the foundation.
------
Yes. Learn from `last30days-skill`, but do **not** copy its scope.

That repo is useful because it shows how to package an AI workflow as a **skill + engine + strict output contract**. Its README says the runtime spec lives in `skills/last30days/SKILL.md`, and that spec is treated as the source of truth for command/setup behavior. That is the exact pattern you should steal for AutoScale Loop 1. ([GitHub][1])

# The correct lesson from `last30days-skill`

`last30days-skill` is not just “a prompt.” It has:

* a `SKILL.md` contract
* a real engine script
* source adapters
* setup/config docs
* tests
* saved outputs/memory
* strict formatting/output rules

Its repo structure includes `SKILL.md`, a main engine script, library modules, docs, configuration, changelog, and tests. ([GitHub][2])

That is the model for AutoScale.

But Loop 1 should be much smaller:

> `Product URL → extracted website content → structured product brief JSON → editable UI → saved source of truth`

Do **not** build a huge multi-source research engine yet.

---

# Build AutoScale Loop 1 as an internal skill system

Your architecture should look like this:

```txt
autoscale/
  app/
    onboarding/
      page.tsx
    projects/[id]/brief/
      page.tsx

  app/api/
    brief/generate/route.ts
    brief/save/route.ts

  lib/
    url/
      validate-url.ts
      normalize-url.ts
    crawler/
      fetch-page.ts
      discover-pages.ts
      extract-content.ts
      clean-content.ts
    agents/
      product-brief-agent.ts
      model-router.ts
    schemas/
      product-brief.schema.ts
    db/
      projects.ts
      product-briefs.ts

  skills/
    product-brief/
      SKILL.md
      examples/
        good-output.json
        weak-output.json
      evals/
        known-sites.json

  AGENTS.md
```

This gives you two layers:

1. **Product runtime** - what users interact with.
2. **Agent skill layer** - what Codex/Cursor/Claude/Hermes use to maintain and improve the system.

That second layer is where you learn from `last30days-skill`.

---

# The big idea: do not make the LLM the system

Bad architecture:

```txt
User URL → giant prompt → random AI output
```

That is weak.

Good architecture:

```txt
User URL
→ deterministic URL validator
→ deterministic crawler
→ deterministic cleaner
→ LLM extraction
→ JSON schema validation
→ confidence scoring
→ editable UI
→ database save
```

The AI should only do the judgment/extraction part. Everything around it should be controlled code.

---

# Core components to build

## 1. URL Validator

This checks:

* URL format
* `https://` normalization
* blocked domains
* localhost/private IP protection
* reachable page
* timeout handling

This protects you from broken links and dangerous SSRF-style fetches.

Minimum function:

```ts
export function normalizeProductUrl(input: string): string {
  const trimmed = input.trim();

  const withProtocol =
    trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;

  const url = new URL(withProtocol);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }

  return url.toString();
}
```

---

## 2. Page Fetcher

Fetch:

* homepage
* `/pricing`
* `/features`
* `/about`
* maybe `/product`

Do not crawl everything.

Hard limits:

```txt
maxPages = 5
timeout = 10 seconds
maxHtmlSize = 2MB
maxExtractedText = 25k-40k chars
```

Do not be greedy. Greedy crawlers become slow, expensive, and unreliable.

---

## 3. Page Discovery

From the homepage, find links that include words like:

```txt
pricing
features
product
about
solutions
customers
```

Then pick the best 3-5 pages.

Example:

```ts
const IMPORTANT_PATHS = [
  "pricing",
  "features",
  "product",
  "about",
  "solutions",
  "customers",
];
```

---

## 4. Content Extractor

For each page, extract:

* title
* meta description
* h1/h2/h3
* button text
* main body text
* pricing text
* testimonials
* feature blocks

The output should look like:

```ts
type ExtractedPage = {
  url: string;
  title: string | null;
  description: string | null;
  headings: string[];
  ctas: string[];
  bodyText: string;
};
```

---

## 5. Content Cleaner

Remove garbage:

* nav repetition
* cookie banners
* footer links
* legal text
* repeated menu items
* “Sign in”
* “Privacy policy”
* “Terms”
* “All rights reserved”

This matters more than you think. Bad extraction will poison the brief.

---

# Product Brief Agent

This is your first real AutoScale agent.

It should receive:

```ts
type ProductBriefAgentInput = {
  sourceUrl: string;
  pages: ExtractedPage[];
  advancedContext?: {
    audience?: string;
    competitors?: string[];
    tone?: string;
    cta?: string;
    offer?: string;
    platforms?: string[];
    campaignGoal?: string;
  };
};
```

It should return validated JSON:

```ts
type ProductBrief = {
  productName: string;
  sourceUrl: string;
  oneLineDescription: string;
  category: string;
  productType: string;

  whatItDoes: string;
  targetAudience: string[];
  problemSolved: string;
  corePromise: string;
  keyFeatures: string[];
  keyBenefits: string[];

  likelyCompetitors: {
    name: string;
    reason: string;
    confidence: "low" | "medium" | "high";
  }[];

  alternativeSolutions: string[];
  marketCategory: string;

  contentAngles: string[];
  platformRecommendations: {
    platform: string;
    reason: string;
  }[];

  ctaSuggestions: string[];
  founderLedOpportunities: string[];
  positioningGaps: string[];

  confidence: {
    overall: "low" | "medium" | "high";
    audience: "low" | "medium" | "high";
    features: "low" | "medium" | "high";
    competitors: "low" | "medium" | "high";
    positioning: "low" | "medium" | "high";
  };

  extractionNotes: string[];
};
```

Use Zod or another schema validator. The point is simple: **never trust raw AI output.**

---

# The `SKILL.md` you should create

This is where you copy the *pattern* from `last30days-skill`.

Create:

```txt
skills/product-brief/SKILL.md
```

Purpose:

```md
# Product Brief Skill

This skill turns a startup/product URL into a structured product brief.

It must not generate TrendWatch reports, hooks, scripts, schedules, or experiments.

Its only job is:
URL → product understanding → validated editable brief.

## Hard Rules

1. Do not invent facts that are not supported by the website.
2. Use confidence scores when guessing.
3. Return JSON only.
4. Separate extracted facts from strategic guesses.
5. If the website is unreadable, request fallback copy.
6. Competitors must be labeled as guesses unless directly found on the site.
7. The product brief becomes the source of truth for future AutoScale agents.

## Required Output

Return a ProductBrief JSON object matching `lib/schemas/product-brief.schema.ts`.
```

That is how you prevent agent drift.

`last30days-skill` is aggressive about contracts because models drift. Its SKILL file explicitly tells the agent not to improvise and to follow the skill contract. ([GitHub][3])

AutoScale needs the same discipline.

---

# Database tables

Use Supabase/Postgres.

## `projects`

```sql
create table projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  product_brief_id uuid,
  status text not null default 'brief_pending',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

## `product_briefs`

Use JSONB heavily at first. Do not over-normalize early.

```sql
create table product_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  source_url text not null,

  product_name text,
  one_line_description text,
  category text,
  product_type text,

  what_it_does text,
  target_audience jsonb,
  problem_solved text,
  core_promise text,
  key_features jsonb,
  key_benefits jsonb,

  likely_competitors jsonb,
  alternative_solutions jsonb,
  market_category text,

  content_angles jsonb,
  platform_recommendations jsonb,
  cta_suggestions jsonb,
  founder_led_opportunities jsonb,
  positioning_gaps jsonb,

  confidence jsonb,
  extraction_notes jsonb,

  raw_extracted_content jsonb,
  model_used text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```

This is practical. You can normalize later when the product proves value.

---

# API routes

## `POST /api/brief/generate`

Input:

```json
{
  "url": "https://example.com",
  "advancedContext": {}
}
```

Process:

```txt
validate URL
fetch homepage
discover useful pages
fetch selected pages
extract content
clean content
call Product Brief Agent
validate JSON
return brief draft
```

Output:

```json
{
  "projectId": "uuid",
  "briefDraft": {}
}
```

Do **not** save as final yet. Save either as draft or return to UI first.

---

## `POST /api/brief/save`

Input:

```json
{
  "projectId": "uuid",
  "brief": {}
}
```

Process:

```txt
validate brief schema
save product_briefs row
update projects.product_brief_id
set project.status = brief_saved
```

Output:

```json
{
  "success": true,
  "nextAction": "generate_trendwatch"
}
```

---

# UI screens

## Screen 1

```txt
Paste your product URL.
Generate your growth brief.
```

Single input. Single button.

No advanced fields visible.

Add tiny link:

```txt
Advanced context
```

Hidden by default.

---

## Screen 2

Show agent progress:

```txt
Reading website...
Extracting product details...
Identifying audience...
Mapping positioning...
Finding content angles...
Preparing editable brief...
```

This is not fluff. It makes the product feel agentic.

---

## Screen 3

Editable brief.

Use cards:

```txt
Product Summary
Audience
Problem + Promise
Features + Benefits
Market Guess
Distribution Context
Confidence Notes
```

Important: show low-confidence fields with warning labels.

Example:

```txt
Likely competitors
Confidence: Low
Reason: Competitors were inferred from category, not found directly on the website.
```

That builds trust.

---

# Model router

Do not expose model complexity in Loop 1 UI.

Internally:

```ts
type AgentModelMode = "auto" | "fast" | "smart" | "creative" | "custom";
```

For Loop 1:

```txt
default = smart/cheap-enough structured extraction model
fallback = stronger reasoning model if output validation fails twice
```

The model router should do:

```txt
try fast structured model
validate JSON
if invalid → retry with repair prompt
if still invalid → stronger model
if still invalid → fail gracefully
```

That is the “AutoScale Auto Router.”

---

# Tests you need immediately

This is another lesson from `last30days-skill`: the repo has a test-heavy structure and its docs reference over 1,000 tests. ([GitHub][1])

For AutoScale Loop 1, create fixtures:

```txt
fixtures/sites/
  simple-saas.html
  ai-tool.html
  ecommerce-tool.html
  agency.html
  blocked-site.html
  weak-copy-site.html
```

Test these:

1. URL normalization works.
2. Bad URLs fail safely.
3. Extractor captures headings and CTAs.
4. Cleaner removes nav/footer junk.
5. Agent returns valid JSON.
6. Missing website content triggers fallback.
7. Saved brief can be loaded by project ID.
8. Low-confidence guesses are marked correctly.

This is not optional. Without evals, every model change can quietly damage your product.

---

# What to borrow from `last30days-skill`

Borrow these patterns:

## 1. Skill contract as source of truth

Their README says the runtime spec lives in `SKILL.md`. ([GitHub][1])

For AutoScale:

```txt
skills/product-brief/SKILL.md
```

This tells agents exactly how Product Brief generation works.

## 2. Engine separate from instructions

Their structure separates the skill definition from the engine script and library modules. ([GitHub][2])

For AutoScale:

```txt
SKILL.md = behavior contract
product-brief-agent.ts = agent logic
crawler/*.ts = deterministic extraction
schema/*.ts = validation
```

## 3. Preflight before execution

`last30days-skill` has explicit preflight logic before running research. For AutoScale, your preflight is:

```txt
Is URL valid?
Is site reachable?
Is content readable?
Is enough text extracted?
Is fallback needed?
```

## 4. Saved memory

`last30days-skill` saves research files and can persist findings across runs with storage options. ([GitHub][1])

For AutoScale:

```txt
Project brief = memory layer 1
TrendWatch report = memory layer 2
Experiments = memory layer 3
Winners/losers = memory layer 4
```

## 5. Strict output contract

Their SKILL file exists partly because models drift and improvise. ([GitHub][3])

For AutoScale:

```txt
JSON schema only.
No free-form essays.
No unsourced certainty.
No fake competitors as facts.
```

---

# What not to borrow

Do **not** borrow:

* huge multi-platform scraping yet
* “last 30 days” recency logic yet
* complex setup wizard
* too many sources
* huge skill docs
* command-line-first UX

Your product is not a research CLI.

Your product is:

> one URL becomes a distribution workspace.

Loop 1 is the entry point.

---

# Your build order

Build in this order:

## Phase 1: Static prototype

Fake the backend first.

Create UI where:

```txt
URL input → mocked brief JSON → editable brief page → save button
```

This validates the user experience.

## Phase 2: Real website extraction

Add:

```txt
URL validator
homepage fetcher
HTML extractor
cleaner
```

Still no AI.

Show extracted content in dev logs/admin mode.

## Phase 3: Product Brief Agent

Add LLM call with JSON schema.

Strictly validate output.

## Phase 4: Database save

Add Supabase:

```txt
projects
product_briefs
```

Save draft and final brief.

## Phase 5: Fallback flow

If scraping fails:

```txt
Paste your homepage copy or product description.
```

Then generate brief from that.

## Phase 6: Evals

Add test fixtures before building Loop 2.

---

# The exact Codex/Cursor prompt I’d use

```txt
We are building AutoScale Loop 1: URL → Editable Product Brief.

Do not build TrendWatch, content generation, scheduling, analytics, billing, teams, or social integrations.

Implement only the first loop.

Goal:
A user pastes a startup/product URL. The app fetches the site, extracts useful website content, generates a structured Product Brief JSON using an LLM, displays the brief in an editable UI, and saves it to Supabase as the project source of truth.

Architecture requirements:
1. Add URL-only onboarding page.
2. Add API route POST /api/brief/generate.
3. Add API route POST /api/brief/save.
4. Add URL validator and normalizer.
5. Add simple crawler:
   - homepage
   - pricing page if found
   - features page if found
   - about page if found
   - max 5 pages total
6. Extract:
   - page title
   - meta description
   - headings
   - CTA/button text
   - main body text
7. Clean repeated nav/footer/cookie/legal junk.
8. Add ProductBrief Zod schema.
9. Make LLM return JSON only.
10. Validate AI output against schema.
11. Add editable Product Brief UI.
12. Save final brief to Supabase.
13. Add fallback manual text input when website cannot be read.
14. Add tests/fixtures for URL validation, extraction, cleaning, and schema validation.

Create:
- lib/url/normalize-url.ts
- lib/crawler/fetch-page.ts
- lib/crawler/discover-pages.ts
- lib/crawler/extract-content.ts
- lib/crawler/clean-content.ts
- lib/schemas/product-brief.schema.ts
- lib/agents/product-brief-agent.ts
- app/api/brief/generate/route.ts
- app/api/brief/save/route.ts
- app/onboarding/page.tsx
- app/projects/[id]/brief/page.tsx
- skills/product-brief/SKILL.md
- AGENTS.md updates explaining Loop 1 boundaries

Hard rules:
- No free-form AI output.
- No fake certainty.
- Competitors must be marked as guesses unless directly discovered.
- Include confidence scores.
- Keep advanced context hidden by default.
- The saved Product Brief is the source of truth for future agents.

Do not overbuild.
```

---

# My hard take

The killer move is not copying `last30days-skill`.

The killer move is copying its **discipline**:

```txt
contract → engine → adapters → schema → memory → tests
```

For AutoScale Loop 1:

```txt
Product Brief SKILL.md
→ website extraction engine
→ ProductBrief JSON schema
→ editable UI
→ Supabase memory
→ eval fixtures
```

Build that cleanly and you have the foundation for “Cursor for distribution.”

Build TrendWatch before this and you are stacking strategy on top of garbage context. That will fail.

[1]: https://github.com/mvanhorn/last30days-skill "GitHub - mvanhorn/last30days-skill: AI agent skill that researches any topic across Reddit, X, YouTube, HN, Polymarket, and the web - then synthesizes a grounded summary · GitHub"
[2]: https://github.com/mvanhorn/last30days-skill/blob/main/AGENTS.md "last30days-skill/AGENTS.md at main · mvanhorn/last30days-skill · GitHub"
[3]: https://github.com/mvanhorn/last30days-skill/blob/main/skills/last30days/SKILL.md "last30days-skill/skills/last30days/SKILL.md at main · mvanhorn/last30days-skill · GitHub"
