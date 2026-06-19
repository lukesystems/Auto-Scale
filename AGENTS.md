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

## Active build direction

The current focus is the **Scraping Engine**.

AutoBrief already gives the product context. The next layer must discover and enrich public competitor/source evidence before TrendWatch reasons deeply.

Agents should treat this as the active next loop:

```txt
Saved Product Brief
→ discovery query plan
→ source candidates
→ safe fetch/enrichment
→ source classification
→ signal scoring
→ pattern mining
→ TrendWatch-ready insights
```

Do not treat this as a generic scraper. It is a growth intelligence engine.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase Auth + Postgres + Storage
- Tailwind + shadcn-style components (Radix primitives)
- AI runtime with task-based model routing
- Zod schema validation for every AI output
- JSZip for export packs
- Postiz integration for scheduling
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
→ content idea
→ generated post
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
- TrendWatch (`services/trendwatch/`)
- Signal Scoring Engine (`services/trendwatch/scoring.ts`)
- Source ingestion and classification (`services/trendwatch/ingestion.ts`, `services/trendwatch/classify-source.ts`)
- Content Conveyor (`services/content-conveyor/`)
- Quality Gate (`services/quality-gate/`)
- Postiz client (`services/postiz/`)
- Export pack builder (`services/export/`)
- Compound Engine (`services/compound/`)
- AI runtime (`services/ai/`)

## What is built today

1. Auth (sign up / in / out, protected routes, RLS)
2. Project CRUD
3. AutoBrief onboarding from a product URL
4. Safe website fetch for AutoBrief
5. Product brief persistence as project source of truth
6. Manual competitor/source input
7. TrendWatch run over provided/enriched sources
8. Source safe fetch, classification, confidence scoring, and distortion risk
9. Hook generation + content idea generation
10. Post draft generation
11. Quality Gate before approval
12. Approval queue
13. Export pack
14. Basic Postiz scheduling with manual export fallback
15. Manual experiment tracker
16. Winner marking → diagnosis + variants + learnings
17. AI run debugger
18. Settings shell with provider visibility

## What is not built yet

Do not falsely claim these exist until code exists:

- autonomous web-wide competitor discovery
- TikTok/X/LinkedIn/YouTube/Reddit adapter-backed source search
- automatic social metric ingestion
- browser automation
- revenue attribution
- website pixel
- payment webhooks
- full autonomous growth operator

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
