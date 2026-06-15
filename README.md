# AutoScale

> **AutoScale helps technical founders find what already works in their niche, turn proven formats into content experiments, distribute them consistently, measure performance, and compound winners into repeatable growth.**

AutoScale is the AI growth operating system for builders. Scale distribution, not servers.

## Core loop

```txt
TrendWatch → Generate → Distribute → Measure → Compound
```

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase Auth + Postgres + RLS + Storage
- Tailwind + shadcn-style UI (Radix primitives, Lucide icons, Sonner toasts)
- AI model abstraction (OpenAI / Anthropic / OpenRouter / Gemini / mock)
- Zod schema validation on every AI output
- JSZip for export packs
- Postiz integration for scheduling

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
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

Optional:

- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` — without any, the mock provider keeps everything working in dev.

### 3. Run the migration

Open Supabase Studio → SQL Editor → paste `supabase/migrations/0001_init.sql` → Run.

Create two private storage buckets:

- `project-assets`
- `project-exports`

### 4. Start the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

> If Supabase env vars are missing, the marketing site still renders and the app routes show a configuration banner instead of crashing.

## Project structure

```txt
autoscale/
├── AGENTS.md                  # Company constitution for AI coding agents
├── app/
│   ├── page.tsx               # Landing page
│   ├── auth/                  # Sign in / up / callback
│   ├── (app)/                 # Authenticated app shell
│   │   ├── projects/          # Project list + create + per-project pages
│   │   ├── settings/          # Account + Postiz settings
│   │   └── debug/             # AI run debugger
│   └── api/                   # Export route etc.
├── components/
│   ├── brand/
│   ├── landing/               # Landing-page sections
│   ├── app/                   # App shell, project nav, page header
│   └── ui/                    # shadcn-style primitives
├── lib/
│   ├── utils.ts
│   └── supabase/              # Client / server / admin / env
├── services/
│   ├── ai/                    # Provider abstraction + runtime + logger
│   ├── product-brief/         # Schemas + generation
│   ├── trendwatch/            # Schemas + scoring + generation
│   ├── content-conveyor/      # Hooks + ideas + post drafts
│   ├── quality-gate/          # Deterministic post checks
│   ├── compound/              # Winner diagnosis + variants
│   ├── postiz/                # Postiz client
│   └── export/                # ZIP / CSV / JSON pack builder
├── skills/                    # Reusable AI skill specs
└── supabase/
    └── migrations/0001_init.sql
```

## V1 workflow (end-to-end)

1. Sign up → Supabase Auth creates a session + a `profiles` row.
2. Create a project.
3. Fill in (or AI-generate) the product brief.
4. Add competitors + source posts.
5. Run TrendWatch → structured insights + signal scoring.
6. Generate hooks + content ideas (linked to insights).
7. Draft posts from ideas (carousel slides + caption + CTA).
8. Approve through Quality Gate.
9. Export ZIP pack, or schedule through Postiz.
10. Enter metrics in the experiment tracker.
11. Mark a winner → diagnose → 10 variants + learnings → next week.

## Roadmap

- V1 (today): Foundation + first growth loop + basic Postiz.
- V1.1: Bulk source import, screenshot analysis, public metadata enrichment.
- V1.2: Full Postiz multi-platform automation, calendar view.
- V1.3: AI Reflection System — weekly retrospective.
- V2: TikTok / Instagram / X / LinkedIn / YT scraping via APIs.
- V2.1: Advanced analytics dashboard.
- V2.2: Full AI image generation pipeline.
- V2.3: Full video generation pipeline.
- V2.4: Affiliate system.
- V2.5: Agency / operator mode.
- V3: Human-supervised autonomous growth operator.

## License

Proprietary — © AutoScale. Built for builders who ship.
