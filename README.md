# AutoScale

> **AutoScale is an AI growth intelligence system for founders. A founder pastes a product URL, AutoScale understands the product, discovers competitor/source signals, reverse-engineers working patterns, turns them into experiments, measures results, and compounds what produces customers.**

AutoScale is built to scale distribution, not servers.

## Current direction

The product direction is now sharper:

```txt
Product URL
→ AutoBrief product understanding
→ Scraping Engine / source discovery
→ TrendWatch competitor intelligence
→ Experiment Pack
→ Distribution
→ Results
→ Compound winners
```

The next serious build focus is the **Scraping Engine**.

AutoBrief gives AutoScale the product context. The Scraping Engine then uses that context to discover and enrich market evidence: competitor sites, social profiles, source posts, creator/shadow accounts, platform patterns, hooks, CTAs, audience pain language, and repeated formats. TrendWatch should reason over real gathered sources, not generic marketing guesses.

See `docs/SCRAPING_ENGINE.md`.

## Managed Mode

AutoScale defaults to **Managed Mode**: server-side environment keys for OpenRouter and Postiz. Non-technical founders do not need to bring API keys.

- Onboarding: `/onboarding` → AutoBrief from a website URL
- Provider status: `/settings/providers`
- Advanced/BYOK mode available for technical users where supported

See `docs/MANAGED_MODE.md`, `docs/AUTOBRIEF.md`, `docs/SCRAPING_ENGINE.md`, and `docs/MODEL_ROUTING.md`.

## Core loop

```txt
Understand → Discover → Analyze → Generate → Distribute → Measure → Compound
```

Do not reduce AutoScale to a scheduler or caption generator. Scheduling is plumbing. The moat is:

```txt
product understanding
+ real source discovery
+ competitor pattern analysis
+ experiment memory
+ revenue-aware compounding
```

## What exists now

The current codebase already has the foundation:

- AutoBrief onboarding from a URL
- safe server-side website fetch with SSRF protection
- structured AutoBrief generation through the AI runtime
- Supabase project + product brief persistence
- user-provided TrendWatch sources
- source fetching, scoring, classification, and confidence handling
- TrendWatch analysis from enriched sources
- content generation, quality gate, export, basic Postiz scheduling, manual experiments, winners, variants, and learnings

## What the Scraping Engine adds next

The Scraping Engine should add the missing discovery layer between AutoBrief and TrendWatch:

1. Generate search queries from the Product Brief.
2. Discover direct competitors, indirect competitors, shadow accounts, review pages, comparison pages, communities, and high-signal content examples.
3. Fetch and normalize source evidence safely.
4. Classify every source by account type, platform, format, hook, CTA, audience pain, distortion risk, confidence, and transferability.
5. Store sources before analysis so TrendWatch can reason from evidence.
6. Produce a Market Source Map and Pattern Brief.
7. Feed TrendWatch, hooks, content ideas, and experiments from those sourced patterns.

The rule is simple: **no source, no strong claim.**

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase Auth + Postgres + RLS + Storage
- Tailwind + shadcn-style UI (Radix primitives, Lucide icons, Sonner toasts)
- AI runtime with task-based model routing
- Zod schema validation on every AI output
- JSZip for export packs
- Postiz integration for scheduling
- Safe source ingestion and confidence scoring

## Get started

### 1. Install

```bash
npm install
```

### 2. Configure

```bash
cp .env.example .env.local
```

Fill in at minimum:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — server-only, never expose

Managed Mode:

- `AUTOSCALE_PROVIDER_MODE_DEFAULT=managed`
- `OPENROUTER_API_KEY` — required for managed AI
- `POSTIZ_API_URL` / `POSTIZ_API_KEY` — required for managed scheduling
- `AUTOSCALE_MODEL_*` — task-based model routing
- `FAL_KEY` — foundation only; media generation not active yet

### 3. Run the migration

Open Supabase Studio → SQL Editor → run migrations in order:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_chain_constraints.sql`
- `supabase/migrations/0003_source_ingestion.sql`
- `supabase/migrations/0004_user_settings.sql`
- `supabase/migrations/0005_phase_1_3_completion.sql`
- `supabase/migrations/0006_loop1_product_brief_source_of_truth.sql`
- `supabase/migrations/0007_loop1_project_status.sql`

Create two private storage buckets:

- `project-assets`
- `project-exports`

### 4. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

### 5. Test commands

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

If Supabase env vars are missing, the marketing site should still render and app routes should show a configuration banner instead of crashing.

## Project structure

```txt
autoscale/
├── AGENTS.md
├── app/
│   ├── page.tsx
│   ├── auth/
│   ├── (app)/
│   │   ├── onboarding/
│   │   ├── projects/
│   │   ├── settings/
│   │   └── debug/
│   └── api/
├── components/
│   ├── brand/
│   ├── landing/
│   ├── app/
│   └── ui/
├── docs/
│   ├── AUTOBRIEF.md
│   ├── SCRAPING_ENGINE.md
│   ├── MODEL_ROUTING.md
│   ├── MANAGED_MODE.md
│   ├── PROVIDER_SECURITY.md
│   └── AI_RUNTIME.md
├── services/
│   ├── ai/
│   ├── autobrief/
│   ├── trendwatch/
│   ├── content-conveyor/
│   ├── quality-gate/
│   ├── compound/
│   ├── postiz/
│   └── export/
├── skills/
│   ├── product-brief/
│   └── trendwatch/
└── supabase/
    └── migrations/
```

## Workflow

1. Sign up → onboarding with AutoBrief.
2. Review generated brief → project created automatically.
3. Scraping Engine discovers competitor/source candidates from the brief.
4. User reviews source candidates where needed.
5. Sources are fetched, classified, scored, and stored.
6. TrendWatch generates competitor intelligence, formats, hooks, risks, and experiments from enriched sources.
7. Content Conveyor generates hooks, content ideas, and posts tied to TrendWatch insights.
8. Quality Gate blocks weak or unanchored posts.
9. Export ZIP pack or schedule through Postiz.
10. Enter metrics in the experiment tracker.
11. Mark winners → diagnose → generate variants → store learnings.

## Roadmap

- V1: Foundation, auth, project workspace, first growth loop, basic Postiz.
- V1.1: Managed Mode, AutoBrief onboarding, OpenRouter task routing.
- V1.2 active focus: Scraping Engine — source discovery, competitor/source map, source enrichment, pattern mining.
- V1.3: Experiment Pack from discovered patterns.
- V1.4: Better Postiz automation and calendar view.
- V1.5: AI Reflection System — weekly retrospective.
- V2: First-party tracking links, website pixel, activation events.
- V2.1: Revenue attribution, payment webhooks, Growth Graph.
- V2.2: Full social/API integrations where available.
- V2.3: Full AI image/video generation pipeline.
- V2.4: Agency/operator mode.
- V3: Human-supervised autonomous growth operator.

## License

Proprietary — © AutoScale. Built for builders who ship.
