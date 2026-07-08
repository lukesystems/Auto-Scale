# AutoScale Product Canvas

> Master reference for product strategy, MVP scope, architecture, and build order.
> Every feature decision should strengthen the core loop or protect the data chain.

## Core Loop

```txt
TrendWatch → Generate → Distribute → Measure → Compound
```

## Core Data Chain

```txt
source → insight → hook → content idea → generated post → scheduled post →
experiment → metric → learning → variant
```

## Positioning

**AutoScale is the AI growth operating system for technical founders.**

- Scale distribution, not servers.
- Growth infrastructure for technical founders.
- Reverse-engineer what already works, turn patterns into experiments, compound winners.

## Target Customer

Technical founders and early-stage SaaS builders who can build products but struggle with distribution.

**First wedge:** B2C AI apps and early SaaS products.

## Product Modules (V1)

| Module | Purpose |
|--------|---------|
| Product Brief Engine | Structured growth brief from product + founder inputs |
| TrendWatch | Reverse-engineer niche, competitors, formats, hooks |
| Signal Scoring Engine | Score source transferability and relevance |
| Content Conveyor | Hooks, ideas, post drafts linked to insights |
| Quality Gate | Deterministic checks before approval |
| ViralOps | Export + basic Post Bridge scheduling |
| Experiment Tracker | Manual metrics per post |
| Compound Engine | Winner diagnosis + 10 variants + learnings |

## V1 Outcome

A founder goes from "I have a startup but no idea what to post" to:

- Researched content plan
- Generated + approved posts
- Scheduled distribution (Post Bridge or export)
- Experiment tracking
- Winner compounding

## V1 Pages

```txt
/  /auth  /projects  /projects/new  /projects/[id]
/projects/[id]/brief  /sources  /trendwatch  /ideas  /content
/projects/[id]/approval  /exports  /schedule  /experiments  /winners
/settings  /settings/publishing  /debug/ai-runs
```

## Engineering Non-Negotiables

- TypeScript throughout
- Supabase Auth + RLS
- Zod-validated AI outputs
- Model abstraction (no single provider lock-in)
- Every generated post links to a TrendWatch insight
- Every scheduled post links to a generated post
- Every experiment links to a generated or scheduled post
- Every winner links to an experiment; every variant links to a winner
- Migrations for all schema changes
- Loading, empty, and error states on all important UI

## Deferred Post-V1

- Full social scraping (TikTok, Instagram, X, LinkedIn)
- Full Post Bridge multi-platform automation
- AI Reflection System (V1.3)
- Advanced analytics dashboard (V2.1)
- Full image/video generation pipelines
- Billing integration (Stripe / Lemon Squeezy)
- Agency / operator mode
- Autonomous growth operator (V3)

## Build Phases

0. Repo constitution (AGENTS.md, docs, skills)
1. SaaS foundation (auth, RLS, projects)
2. Product brief + sources
3. AI foundation (runtime, logs, debug page)
4. TrendWatch
5. Content Conveyor
6. Quality Gate + approval
7. Export + Post Bridge V1
8. Experiment tracker
9. Compound engine

See `AGENTS.md` for current implementation status and `docs/ROADMAP.md` for post-V1 timeline.
