# AGENTS.md

## Project

**AutoScale** is an AI-powered growth intelligence system for technical founders and early-stage SaaS startups.

The product helps founders understand their product, discover public competitor and market signals, reverse-engineer working patterns, turn those patterns into content experiments, distribute consistently, track results, and compound winners.

## Core loop

```txt
Understand → Discover → Analyze → Generate → Distribute → Measure → Compound
```

More explicitly:

```txt
Product URL
→ Product Brief
→ Scraping Engine / source discovery
→ TrendWatch intelligence
→ content experiments
→ distribution
→ experiment results
→ winner variants + learnings
```

## Unified AutoScale flow (current)

Project creation is **URL-only** with a **per-project AI model** picker (curated list + Advanced OpenRouter catalog).

One **continuous Growth Run** absorbs the former separate panels:

```txt
Product URL + model pick
→ autobrief → deep_discovery → video_discovery → pattern_mining → trendhop
→ videotrend → strategy → concepts → render → approval → schedule → compound
```

- Foundation routes (`/brief`, `/sources`, `/video-intelligence`, `/patterns`, `/signals`, `/trendwatch`) **redirect** to the active run view with evidence tabs.
- **TrendHop** runs inside the orchestrator (`trendhop` phase), not as a separate nav surface.
- Global **approval policy** in `/settings`: `auto_approve_all` | `ask_at_critical` | `ask_at_every_stage`. Runs pause with `awaiting_user_input` until the user continues.
- Per-project model stored on `projects.ai_model_slug`; all AI calls use `withProjectAIContext()` when executing a run.

Migration: `0027_unified_flow_model_approval.sql`

## Pivot note (legacy)

The legacy text-loop (ideas → posts → approval → schedule → experiments → winners) is
deprecated. **Growth Run is the sole loop.** Routes for ideas / content /
approval / exports / schedule / experiments / legacy-winners redirect to
`/projects/[id]/growth`.

The legacy `services/trendwatch/` text-insight pipeline still exists at the
service level (referenced by deep discovery and pattern mining) but is not a separate UI panel.

## Active build direction

The unified run loop is live. Ongoing work: harden resumable orchestrator checkpoints, expand approval gate UX, and compound winner automation.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase Auth + Postgres + Storage
- Tailwind + shadcn-style components (Radix primitives)
- AI runtime with task-based model routing
- Zod schema validation for every AI output
- JSZip for export packs
- Postiz / Post Bridge integration for scheduling
- Safe source ingestion, classification, and confidence scoring

## Core Rule

**Protect the evidence chain:**

```txt
source candidate
→ fetched/enriched source
→ classification
→ signal score
→ insight
→ hook
→ concept
→ generated post / video
→ scheduled/exported post
→ experiment
→ metric
→ learning
→ variant
```

Every generated post must link to a TrendWatch insight when available. Every TrendWatch insight must be tied to a source, a run, or an explicit low-confidence caveat.

Never generate disconnected content and never state competitor intelligence as fact without source evidence.

## Product Modules

- AutoBrief / Product Brief Engine (`services/autobrief/`)
- Scraping Engine / source discovery (`docs/SCRAPING_ENGINE.md`; implementation next)
- TrendWatch trend-hop (`services/trendhop/`)
- Signal Scoring Engine (`services/trendwatch/scoring.ts`)
- Source ingestion and classification (`services/trendwatch/ingestion.ts`, `services/trendwatch/classify-source.ts`)
- Content Conveyor (`services/content-conveyor/`)
- Quality Gate (`services/quality-gate/`)
- Postiz / Post Bridge client (`services/postiz/`, `services/postbridge/`)
- Export pack builder (`services/export/`)
- Compound Engine (`services/compound/`)
- AI runtime (`services/ai/`)

## What is built today

1. Auth (sign up / in / out, protected routes, RLS)
2. Project CRUD with `/projects?new=1` modal (From URL + Manual)
3. AutoBrief onboarding from a product URL, with skippable onboarding and "Re-fetch from URL"
4. **LLM-driven product site crawl** wired into the live path (`services/intelligence/product-crawl/llm-extract.ts` → `run-crawl.ts` → `generate.ts`), with `user_settings.crawl_mode` (`llm` default | `heuristic`) and Settings UI toggle
5. Product brief persistence as project source of truth
6. Manual competitor/source input + discovery candidates
7. Source safe fetch, classification, confidence scoring, and distortion risk
8. Video Intelligence references + pattern mining
9. Growth Run loop (Hub → Daily Pack → Graph → Winners) with pre-flight checklist; `growth_runs.batch_kind` (`exploration` | `exploitation`) set automatically from winner history
10. **Compound classifier** taxonomy: winner / promising / flat / kill, driven by `metrics_snapshots` + per-project thresholds in `project_growth_settings`
11. Exploitation runs seed concepts from `growth_experiment_results` winners; TrendHop promotions queue real `video_concepts` rows
12. Standalone **TrendWatch trend-hop**: on-demand + schedulable, Send to Growth Run creates queued concepts
13. Postiz / Post Bridge scheduling with manual export fallback and `ScheduleStatusBadge` (Posted / Queued / Exported)
14. Sidebar navigation + **Run Center** (`/projects/[id]/runs`) with header status pill
15. Evidence chain drawer on video evidence, TrendHop, and growth video cards
16. `getNextMove` banner on Brief, Sources, Video Intelligence, Growth hub, Winners
17. Metrics ingestion via Post Bridge API (`services/metrics-ingestion/`): scheduler endpoint at `/api/cron/metrics-ingestion` + `metrics_snapshots`; auto-creates `growth_experiment_results` on schedule
18. TrendHop scheduler endpoint at `/api/cron/trendhop`; use Supabase `pg_cron` or another external scheduler, not Vercel Cron on the free tier (`docs/SUPABASE_CRON_SETUP.md`)
19. AI run debugger + provider visibility settings shell

## What is not built yet

Do not falsely claim these exist until code exists:

- direct TikTok / Meta / YouTube analytics APIs (stubs return unsupported; use Post Bridge)
- adapter-backed TokAudit / Tokboard / Exolyt trend trackers (Exa-only today)
- autonomous web-wide competitor discovery (partial adapters only)
- automatic revenue attribution, website pixel, payment webhooks (pixel/signup/payment APIs exist but not full attribution loop)
- full autonomous growth operator (autopilot can schedule; cannot auto-start runs without user session)
- winner variant render worker (concepts queued; service-role render path incomplete)
- lazy-loaded evidence chain drawer (v1 passes pre-resolved chains from server)

## Scraping Engine rules

When implementing the Scraping Engine:

1. Start from the saved Product Brief. Do not ask the user for a long form.
2. Generate a discovery query plan before fetching anything.
3. Keep adapters isolated. Do not hardwire search logic into TrendWatch.
4. Store discovered source candidates before analysis.
5. Deduplicate source candidates by canonical URL, platform + handle, and similar title/snippet.
6. Use only public, accessible sources and respect platform access limits.
7. Save fetch status, fetch error, confidence, discovery adapter, and discovery reason.
8. Classify each source by account type, format, hook, angle, CTA pattern, audience pain, transferability, and distortion risk.
9. Label low-confidence and failed sources clearly.
10. TrendWatch must reason over enriched sources, not vague assumptions.

## Engineering Rules

- Always TypeScript.
- Validate every AI output with a Zod schema (`services/*/schema.ts`).
- Use structured JSON outputs — never store key AI output only as markdown.
- Use migrations for schema changes (`supabase/migrations/`).
- Never bypass RLS. Use `createSupabaseAdminClient` only in trusted server contexts.
- Never expose API keys to the client. All AI calls happen in server actions / route handlers.
- Add loading, empty, and error states to all important UI.
- Never hardcode a single AI provider — use `services/ai/runtime.ts`.
- Every generated post must link to a TrendWatch insight when available.
- Every scheduled post must link to a generated post.
- Every experiment must link to a generated or scheduled post.
- Every winner must link to an experiment.
- Every variant must link to a winner.

## AI Rules

- Model abstraction lives in `services/ai/runtime.ts`.
- Use `generateObject()` for structured calls.
- Retry malformed outputs once through the runtime.
- Log every call with `logAIRun()` so `/debug/ai-runs` remains useful.
- Prefer Zod-validated structured outputs over long prose.
- Scraping/TrendWatch outputs must separate observed evidence from strategic inference.
- Do not invent metrics, creators, URLs, competitors, or platform performance.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check
- `npm run test` — Vitest

## Completion Criteria

A task is not complete until:

1. The flow works in the UI.
2. Data is saved in Supabase or cleanly no-op'd when Supabase is not configured.
3. Errors are handled.
4. Empty states exist.
5. Build / lint / typecheck / tests pass where applicable.
6. The implementation respects the source → insight → post → experiment chain.
7. Any AI claim that depends on external evidence is backed by stored source data or explicitly marked low confidence.
