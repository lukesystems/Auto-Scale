# AGENTS.md

## Project

**AutoScale** is an AI-powered distribution operating system for technical founders and early-stage SaaS startups.

Core loop:

```txt
TrendWatch → Generate → Distribute → Measure → Compound
```

The product helps founders find what already works in their niche, turn proven formats into content experiments, distribute consistently, track results, and compound winners.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase Auth + Postgres + Storage
- Tailwind + shadcn-style components (Radix primitives)
- AI model abstraction (OpenAI / Anthropic / OpenRouter / Gemini / mock)
- Zod schema validation for every AI output
- JSZip for export packs
- Postiz integration for scheduling (V1 = basic)

## Core Rule

**Protect the data chain:**

```txt
source → insight → hook → content idea → generated post → scheduled post →
experiment → metric → learning → variant
```

Every generated post must link to a TrendWatch insight (or be explicitly flagged as un-anchored by the Quality Gate). Never generate disconnected content.

## Product Modules

- Product Brief Engine (`services/product-brief/`)
- TrendWatch (`services/trendwatch/`)
- Signal Scoring Engine (`services/trendwatch/scoring.ts`)
- Content Conveyor (`services/content-conveyor/`)
- Quality Gate (`services/quality-gate/`)
- Postiz client (`services/postiz/`)
- Export pack builder (`services/export/`)
- Compound Engine (`services/compound/`)
- AI runtime (`services/ai/`)

## V1 Scope (what's built today)

1. Auth (sign up / in / out, protected routes, RLS)
2. Project CRUD
3. Product brief (manual + AI-generated)
4. Competitor / source input
5. TrendWatch run → structured insights + signal scoring
6. Hook generation + content idea generation
7. Post draft generation (carousel/script with slides, caption, CTA)
8. Quality Gate (deterministic checks before approval)
9. Approval queue
10. Export pack (ZIP / CSV / JSON / captions / Postiz payload preview / experiment tracker template)
11. Basic Postiz scheduling (with manual export fallback)
12. Manual experiment tracker (views, saves, shares, comments, clicks, signups, purchases, revenue, notes)
13. Winner marking → diagnosis + 10 variants + learnings written to project memory
14. AI run debugger
15. Settings shell with provider visibility

## Deferred to post-V1

- Full TikTok / Instagram / X / LinkedIn scraping (V2)
- Full Postiz multi-platform automation (V1.2)
- AI Reflection System (V1.3)
- Advanced analytics dashboard (V2.1)
- Full AI image generation pipeline (V2.2)
- Full video generation pipeline (V2.3)
- Affiliate system (V2.4)
- Agency / operator mode (V2.5)
- Autonomous growth operator (V3)
- Stripe / Lemon Squeezy billing (after first loop proven)

## Engineering Rules

- Always TypeScript.
- Validate every AI output with a Zod schema (`services/*/schema.ts`).
- Use structured JSON outputs — never store key AI output only as markdown.
- Use migrations for schema changes (`supabase/migrations/`).
- Never bypass RLS. Use `createSupabaseAdminClient` only in trusted server contexts.
- Never expose API keys to the client. All AI calls happen in server actions / route handlers.
- Add loading, empty, and error states to all important UI.
- Never hardcode a single AI provider — use `services/ai/runtime.ts`.
- Every generated post must link to a TrendWatch insight when available; Quality Gate enforces this.
- Every scheduled post must link to a generated post.
- Every experiment must link to a generated or scheduled post.
- Every winner must link to an experiment.
- Every variant must link to a winner.

## AI Rules

- Model abstraction lives in `services/ai/runtime.ts`. Use `generateObject()` for structured calls.
- Retry malformed outputs once (built into the runtime).
- Log every call with `logAIRun()` so `/debug/ai-runs` always works.
- Prefer Zod-validated structured outputs over long prose.
- Quality Gate must review generated posts before they enter approval.

## Commands

- `npm install` — install dependencies
- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — TypeScript check

## Completion Criteria

A task is not complete until:

1. The flow works in the UI.
2. Data is saved in Supabase (or no-op'd cleanly when Supabase isn't configured).
3. Errors are handled.
4. Empty states exist.
5. Build / lint passes.
6. The implementation respects the source → insight → post → experiment chain.
