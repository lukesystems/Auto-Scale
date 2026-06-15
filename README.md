# AutoScale

> **AutoScale helps founders find what already works in their niche, turn proven formats into content experiments, distribute them consistently, measure performance, and compound winners into repeatable growth.**

AutoScale is the AI growth operating system for builders. Scale distribution, not servers.

## Managed Mode (V1.1 default)

AutoScale defaults to **Managed Mode**: server-side env keys for OpenRouter and Postiz. Non-technical founders do not need to bring API keys.

- Onboarding: `/onboarding` → AutoBrief from your website URL
- Provider status: `/settings/providers`
- Advanced/BYOK mode available for technical users (own Postiz keys)

See `docs/MANAGED_MODE.md`, `docs/AUTOBRIEF.md`, `docs/MODEL_ROUTING.md`.

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

Managed Mode (optional for local dev — mock AI works without keys):

- `AUTOSCALE_PROVIDER_MODE_DEFAULT=managed`
- `OPENROUTER_API_KEY` — required for real managed AI
- `POSTIZ_API_URL` / `POSTIZ_API_KEY` — required for managed scheduling
- `AUTOSCALE_MODEL_*` — task-based OpenRouter routing (see `docs/MODEL_ROUTING.md`)
- `FAL_KEY` — foundation only; media generation not active yet

### 3. Run the migration

Open Supabase Studio → SQL Editor → run migrations in order:

- `supabase/migrations/0001_init.sql`
- `supabase/migrations/0002_chain_constraints.sql`
- `supabase/migrations/0003_source_ingestion.sql`
- `supabase/migrations/0004_user_settings.sql`

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

1. Sign up → onboarding (`/onboarding`) with AutoBrief (Managed Mode default).
2. Review generated brief → project created automatically.
3. Add competitors + source posts (or use AutoBrief suggestions).
4. Run TrendWatch → structured insights + signal scoring.
5. Generate hooks + content ideas (linked to insights).
6. Draft posts from ideas (carousel slides + caption + CTA).
7. Approve through Quality Gate.
8. Export ZIP pack, or schedule through managed/BYOK Postiz.
9. Enter metrics in the experiment tracker.
10. Mark a winner → diagnose → 10 variants + learnings → next week.

## Roadmap

- V1 (today): Foundation + first growth loop + basic Postiz.
- V1.1 (this branch): Managed Mode, AutoBrief onboarding, OpenRouter task routing.
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
