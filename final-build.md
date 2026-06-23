# AutoScale Final Build Document

## From Current Autopilot State to Full VidGuy-Level Short-Form Video Growth Engine

## 0. Core Decision

AutoScale should not become a generic AI video generator.

AutoScale should become:

> A trend-aware short-form video growth agent for SaaS founders.

VidGuy’s lesson is clear:

> One prompt → agent writes → voices → edits → publishes → tracks.

AutoScale’s stronger version:

> Product URL → product intelligence → trend intelligence → video strategy → video production → Postiz publishing → tracking → revenue attribution → compound winners.

VidGuy is the production benchmark.  
AutoScale wins through trend scraping, product understanding, SaaS-specific strategy, and business-result compounding.

---

# 1. Final Product Promise

## Hero

Ship videos that learn what brings users.

## Subheadline

Paste your product URL. AutoScale studies your niche, finds winning short-form video patterns, creates TikToks, Reels, and Shorts, posts them through your accounts, tracks results, and compounds the winners.

## CTA

Start Your First Growth Run

## Support Line

Trend research → Video creation → Posting → Tracking → Winner variants

## Positioning

Built for SaaS founders who need distribution, not another content calendar.

---

# 2. What AutoScale Must Learn From VidGuy

VidGuy’s product is strong because it has a complete production loop:

```txt
Prompt
→ strategy extraction
→ script generation
→ voiceover
→ visual assembly
→ SFX/music
→ platform render
→ review
→ deploy
→ track growth

```

AutoScale must copy the **workflow clarity**, not the exact positioning.

## VidGuy Infrastructure Concepts to Model

### 1. Simple Input

VidGuy uses one prompt.

AutoScale uses:

```txt
Product URL

```

AutoScale should infer the rest:

```txt
product
audience
pain
offer
CTA
competitors
video angles
platform mix
posting loadout
approval mode

```

### 2. Autonomous Production

VidGuy turns a loose idea into a finished asset.

AutoScale should turn a product URL and trend evidence into finished video campaigns.

### 3. Multi-Scene Workflow

VidGuy thinks in scenes:

```txt
Scene 1: hook
Scene 2: problem
Scene 3: value/demo
Scene 4: CTA

```

AutoScale should also use scene-level orchestration:

```txt
storyboard_scene
asset_method
voiceover_line
subtitle_line
visual_prompt
duration
transition

```

### 4. Model Orchestration

VidGuy uses different AI models for different media tasks.

AutoScale should use:

```txt
LLM:
product brief, trend analysis, scripts, strategy, captions

fal/Seedance:
AI b-roll and visual metaphor clips

Slide renderer:
fast deterministic SaaS videos

ffmpeg:
final assembly

TTS:
voiceover

Subtitles:
SRT and burned captions

Storage:
final MP4s and assets

Postiz:
publishing/scheduling

Tracking:
links, pixel, signup events, payment events

```

### 5. Daily Pack

VidGuy has daily ready-to-post content.

AutoScale should create:

> Daily Growth Pack

```txt
3 ready-to-post videos
2 trend-backed hooks
1 winner variant
1 competitor pattern to test
1 weak format to avoid
1 posting recommendation

```

### 6. API / Agentic Workflow Layer

VidGuy exposes a video API / MCP style connector.

AutoScale should eventually expose:

```txt
POST /api/growth-runs
POST /api/videos/render
POST /api/videos/revise
POST /api/autopilot/run
GET /api/growth-packs/today
POST /api/reference/remix

```

Later:

```txt
MCP connector
Cursor/Claude/Hermes trigger support
Webhook-based growth automation

```

---

# 3. Current AutoScale State

Current implemented system:

```txt
Growth Run spine
Product Brief → VideoTrend → Strategy → Concepts → Scripts → Storyboards
Slide renderer
fal/Seedance clip service
Voiceover service
Subtitle service
ffmpeg assembler
Growth media storage
Videos can become ready
Postiz media upload
Export pack fallback
Autopilot cron
Tracked links
Pixel events
Signup/payment events
Manual metrics
Compound classifier
GitHub Actions CI

```

This means the **skeleton exists**.

The next work is not “start building AutoScale.”

The next work is:

```txt
1. verify runtime
2. harden autopilot
3. deepen trend intelligence
4. improve video quality
5. build Daily Growth Pack
6. add reference-to-variant
7. deepen Growth Graph attribution
8. make compound engine smarter
9. ship final landing/onboarding

```

---

# 4. Final System Architecture

```txt
AutoScale
├── Product URL Intake
├── Product Intelligence Agent
├── Trend Scraper / VideoTrend Engine
├── Competitor Pattern Fingerprints
├── Video Strategy Engine
├── Video Factory
│   ├── Slide Renderer
│   ├── Demo Short Builder
│   ├── fal/Seedance Clip Generator
│   ├── Voiceover Generator
│   ├── Subtitle Generator
│   ├── ffmpeg Assembler
│   └── Storage Uploader
├── Daily Growth Pack
├── Approval Queue
├── Autopilot Controller
├── Postiz Distribution
├── Export Pack Fallback
├── Tracking Layer
│   ├── Tracked Links
│   ├── Pixel
│   ├── Signup Events
│   └── Payment Events
├── Growth Graph
├── Compound Engine
├── Account Health Engine
└── API / Agent Connector Layer

```

---

# 5. Infrastructure Blueprint

## Frontend

Use existing app structure.

Main pages:

```txt
/
landing page

/projects/[id]/growth
Growth Run dashboard

/projects/[id]/growth/[runId]
Growth Run detail page

/projects/[id]/growth/daily
Daily Growth Pack

/projects/[id]/growth/trends
VideoTrend evidence

/projects/[id]/growth/settings
Autopilot, tracking, accounts, webhooks

```

## Backend

Core services:

```txt
services/growth-run/orchestrator.ts
services/product-brief/*
services/videotrend/*
services/video-strategy/*
services/video-factory/*
services/postiz/*
services/tracking/*
services/compound/*
services/autopilot/*
services/export/*
services/account-health/*
services/growth-graph/*

```

## Storage

Use Supabase Storage bucket:

```txt
growth-media

```

Stores:

```txt
scene PNGs
AI clips
voiceover audio
subtitle files
final MP4s
export ZIPs

```

## Media Pipeline

```txt
storyboard_scenes
→ generated_assets
→ video_factory_render_job
→ final MP4
→ storage upload
→ videos.status = ready

```

## Worker / Cron Layer

Current cron:

```txt
POST /api/cron/autopilot

```

Future workers:

```txt
render_worker
trend_refresh_worker
autopilot_worker
compound_worker
metrics_ingest_worker
daily_pack_worker

```

Do not overload request/response routes with long render jobs in production. Render work should move to queue-backed workers as volume increases.

## Distribution

Primary:

```txt
Postiz

```

Fallback:

```txt
Export Pack ZIP

```

Do not build native TikTok/IG/YT integrations first unless Postiz becomes a blocker.

## Tracking

Owned-side first:

```txt
/r/[code]
/api/pixel
/api/events/signup
/api/events/payment

```

Manual platform metrics remain necessary for v1/v2.

---

# 6. Data Model Expansion

Current database already has the Growth Run spine. Now deepen it.

## Add / Deepen Trend Tables

```txt
trend_sources
- id
- project_id
- growth_run_id
- source_type
- source_url
- platform
- competitor_name
- status
- created_at

trend_videos
- id
- project_id
- source_id
- platform
- external_url
- creator_handle
- caption
- transcript
- views
- likes
- comments
- shares
- saves
- duration_seconds
- posted_at
- scraped_at

trend_evidence
- id
- project_id
- trend_video_id
- evidence_type
- evidence_summary
- confidence
- created_at

competitor_fingerprints
- id
- project_id
- competitor_name
- platform
- winning_formats
- hook_patterns
- CTA_patterns
- visual_patterns
- weaknesses
- opportunities
- updated_at

trend_receipts
- id
- project_id
- growth_run_id
- video_concept_id
- evidence_items
- reasoning
- confidence_score

```

## Add / Deepen Daily Pack Tables

```txt
daily_growth_packs
- id
- project_id
- date
- status
- goal
- summary
- created_at

daily_growth_pack_items
- id
- pack_id
- video_id
- concept_id
- item_type
- reason
- priority
- status

```

## Add Video Quality Tables

```txt
video_quality_scores
- id
- project_id
- video_id
- hook_strength
- clarity
- pacing
- text_density
- CTA_strength
- platform_fit
- brand_safety
- duplicate_risk
- claim_risk
- overall_score
- block_reason

```

## Add Growth Graph Events

```txt
growth_events
- id
- project_id
- growth_run_id
- video_id
- event_type
- source
- platform
- account_id
- tracked_link_id
- anonymous_id
- user_email_hash
- revenue_cents
- metadata
- attribution_confidence
- occurred_at

```

This eventually becomes the single event stream for all learning.

---

# 7. Build Phases

## Phase 1: Runtime Verification

### Goal

Prove the current loop works outside theory.

### Tasks

```txt
1. Apply all Supabase migrations.
2. Confirm growth-media bucket exists.
3. Run a Growth Run from the UI.
4. Confirm storyboard scenes are created.
5. Confirm slide PNGs are created.
6. Confirm voiceover or silent fallback works.
7. Confirm subtitles are generated.
8. Confirm ffmpeg creates MP4.
9. Confirm MP4 uploads to storage.
10. Confirm videos.status becomes ready.
11. Download export pack.
12. Schedule one ready video through Postiz test account.
13. Click tracked link.
14. Fire pixel event.
15. Fire signup/payment test event.
16. Enter manual metrics.
17. Run compound classifier.
18. Confirm winner/loser output.

```

### Acceptance Criteria

```txt
One real Growth Run can create one playable video, schedule/export it, track a click/signup/payment, and generate a compound result.

```

### Cursor Instruction

```txt
Do runtime verification first. Do not add new features until one complete Growth Run succeeds end-to-end.

```

---

## Phase 2: Autopilot v1 Hardening

### Goal

Autopilot must be safe before it is powerful.

### Build

Autopilot modes:

```txt
manual
assisted
full

```

Default:

```txt
manual for first Growth Run

```

Assisted mode:

```txt
auto-approve safe slide/demo videos
require approval for risky content

```

Full mode:

```txt
explicit user opt-in only

```

### Rules

```txt
max_posts_per_account_per_day
min_minutes_between_posts
allowed_platforms
allowed_video_types
blocked_video_types
require_approval_for_claims
require_approval_for_competitor_mentions
minimum_quality_score
minimum_variation_score
pause_on_failed_posts
pause_on_low_engagement_streak

```

### Cron Behavior

```txt
1. Find active projects.
2. Check account health.
3. Render pending videos.
4. Score videos.
5. Auto-approve only if rules pass.
6. Schedule approved ready videos.
7. Log skipped items with reasons.
8. Run compound on posted videos.
9. Generate variants.
10. Prepare next pack.

```

### Acceptance Criteria

```txt
Autopilot can run without posting unsafe, duplicate, unready, or low-quality videos.

```

---

## Phase 3: VidGuy-Level Production UX

### Goal

Make the product feel like an agent, not a form-based tool.

### Build UI Flow

```txt
Mission Input:
Paste product URL or describe campaign goal.

Agent Plan:
AutoScale shows the strategy before producing.

Production:
AutoScale shows scenes, scripts, visuals, audio, captions.

Review:
User can approve, reject, edit, regenerate, or ask for revision.

Deploy:
Postiz schedule or export pack.

Track:
Views, clicks, signups, revenue, winners, losers.

Learn:
Next variants and daily pack.

```

### UX Components

```txt
Agent activity panel
Scene timeline
Video preview card
Trend receipt drawer
Quality score card
Approval controls
Autopilot rule indicator
Postiz schedule preview
Compound recommendation card

```

### Acceptance Criteria

```txt
A founder can understand what AutoScale is doing at every stage without reading logs.

```

---

## Phase 4: VideoTrend v2 — Evidence Engine

### Goal

TrendWatch must stop being generic AI strategy and become evidence-backed research.

### Inputs

```txt
competitor URLs
manual reference videos
public metadata
YouTube/Shorts search where available
internal past winners
manual imported examples

```

### Processing

```txt
1. Collect source videos.
2. Extract metadata.
3. Extract transcript/caption where possible.
4. Classify hook pattern.
5. Classify video structure.
6. Classify CTA.
7. Classify visual style.
8. Identify repeated patterns.
9. Identify competitor gaps.
10. Produce recommended experiments.

```

### Output

```txt
winning_structures
hook_patterns
opening_frame_patterns
CTA_patterns
video_length_patterns
visual_patterns
audience_language
competitor_gaps
market_white_space
recommended_experiments
confidence_score

```

### Trend Receipts

Every video concept must have:

```txt
trend_receipts
why_this_video_exists
source_patterns
expected_signal
confidence

```

### Acceptance Criteria

```txt
No video concept is generated without trend reasoning.

```

---

## Phase 5: Video Strategy Score

### Goal

Give the founder a clear diagnosis before generating videos.

### Score Areas

```txt
product_clarity
audience_specificity
pain_strength
demo_potential
trend_fit
proof_assets
CTA_strength
platform_fit
production_feasibility
revenue_signal_potential

```

### Output Example

```txt
Video Strategy Score: 78/100

Strong:
- clear product workflow
- strong demo potential
- strong pain angle

Weak:
- weak proof assets
- no customer examples
- CTA not specific enough

Recommended Mix:
50% demo shorts
25% slide explainers
15% AI b-roll
10% founder POV

```

### Acceptance Criteria

```txt
AutoScale explains why it chose the video mix and posting loadout.

```

---

## Phase 6: Video Factory v2

### Goal

Move from “MP4 exists” to “videos are genuinely usable.”

### Production Modes

```txt
fast_slides
demo_short
ai_broll_short
founder_pov
ugc_presenter
reference_remix

```

### Fast Slides

Use for volume.

Needs:

```txt
strong typography
motion background
subtitle sync
CTA end card
brand colors

```

### Demo Shorts

Use for SaaS conversion.

Needs:

```txt
screen recording upload
screenshot sequence
zoom/pan
cursor highlight
before/after workflow
CTA overlay

```

### AI B-Roll

Use for attention.

Needs:

```txt
Seedance/fal visual metaphor clips
voiceover
subtitles
brand-safe prompts

```

### Founder POV

Use for trust.

Needs:

```txt
script for founder
teleprompter view
manual recording support later

```

### UGC Presenter

Use carefully.

Needs:

```txt
clear disclosure controls
no fake testimonials
no false customer claims

```

### Reference Remix

Use for competitor-inspired safe variants.

Needs:

```txt
extract structure
remove brand-specific details
generate safe variants
avoid copying exact script

```

### Acceptance Criteria

```txt
AutoScale can create multiple video types and chooses the right mode per strategy.

```

---

## Phase 7: Daily Growth Pack

### Goal

Make AutoScale a daily workflow, not a one-off generator.

### Daily Pack Includes

```txt
3 ready-to-post videos
2 trend-backed hooks
1 winner variant
1 competitor pattern
1 weak format to avoid
1 recommended posting loadout

```

### Inputs

```txt
latest VideoTrend report
recent winners
recent losers
learning memory
account capacity
autopilot rules
campaign goal

```

### UI

```txt
Today's Growth Pack

- Approve all safe videos
- Edit video
- Regenerate
- Schedule
- Export
- Why this exists

```

### Acceptance Criteria

```txt
Every morning, founder gets a useful set of ready-to-post video actions.

```

---

## Phase 8: Reference-to-Variant

### Goal

Let user paste a winning video/reference and create safe versions.

### Flow

```txt
Paste video URL
→ extract metadata/transcript
→ identify structure
→ identify hook mechanism
→ identify CTA
→ strip specific brand/copyrighted wording
→ adapt to product brief
→ generate variants
→ render videos

```

### Output

```txt
Original pattern:
Pain → shortcut → result

AutoScale variants:
- slide version
- demo version
- founder POV version
- AI b-roll version
- objection-handling version

```

### Guardrails

```txt
no copying exact scripts
no impersonation
no fake customer proof
no competitor defamation
no misleading revenue claims

```

### Acceptance Criteria

```txt
Reference-to-Variant creates original product-specific videos from proven structures.

```

---

## Phase 9: Growth Graph Attribution

### Goal

AutoScale must know what brings users.

### Chain

```txt
Trend insight
→ video pattern
→ concept
→ script
→ video
→ platform
→ account
→ click
→ signup
→ activation
→ payment
→ learning

```

### Events

```txt
video_generated
video_approved
video_scheduled
video_posted
link_clicked
page_viewed
cta_clicked
signup_started
signup_completed
activation_completed
payment_started
subscription_started
invoice_paid
manual_metrics_entered
compound_classified
variant_generated
format_killed

```

### Attribution Confidence

```txt
high:
tracked click → signup/payment

medium:
same session/browser

low:
self-reported source

unknown:
no attribution

```

### Acceptance Criteria

```txt
AutoScale can tell the founder which videos produced clicks, signups, activation, and revenue.

```

---

## Phase 10: Compound Engine v3

### Goal

Every Growth Run improves the next one.

### Classifications

```txt
revenue_winner
signup_winner
attention_winner
weak_hook
weak_body
weak_cta
wrong_audience
message_mismatch
low_quality_asset
duplicate_fatigue
platform_mismatch
loser
inconclusive

```

### Actions

```txt
revenue_winner:
increase volume, create cross-platform variants

signup_winner:
create more variants around same pain/CTA

attention_winner:
test stronger CTA

weak_hook:
rewrite opening 2 seconds

weak_body:
keep hook, change middle

weak_cta:
change CTA

wrong_audience:
change angle/platform

loser:
kill for 14 days

inconclusive:
collect more data

```

### Acceptance Criteria

```txt
Compound Engine changes future strategy, not just labels old posts.

```

---

## Phase 11: Account Health and Posting Safety

### Goal

Prevent AutoScale from behaving like spam automation.

### Track

```txt
posts_per_day
failed_posts
duplicate_hook_rate
duplicate_caption_rate
engagement_drop
platform_errors
manual_pause
recent_schedule_density

```

### Safety Rules

```txt
no identical videos across many accounts
no repeated hook within 7 days on same account
no posting above account limit
pause after repeated errors
no risky format without approval
reduce volume after weak signals

```

### Note On Hosted/Warmed Accounts

Do not build hosted/warmed accounts now.

They create platform-risk, trust-risk, and operational-risk.

AutoScale should use:

```txt
user-connected accounts
Postiz integrations
account health monitoring
variation rules
safe posting loadouts

```

Maybe later, after product-market fit, consider managed distribution partnerships. Not now.

### Acceptance Criteria

```txt
Autopilot can increase, reduce, or pause volume safely.

```

---

## Phase 12: API / Agent Connector Layer

### Goal

Match VidGuy’s agentic-world infrastructure direction without bloating the product.

### Internal API

```txt
POST /api/growth-runs
POST /api/growth-runs/:id/render
POST /api/growth-runs/:id/schedule
POST /api/growth-runs/:id/compound
GET /api/growth-packs/today
POST /api/reference/remix
POST /api/videos/:id/revise

```

### Future MCP Connector

Expose controlled actions:

```txt
create_growth_run
get_daily_growth_pack
render_video
revise_video
schedule_video
export_pack
get_results
create_variants_from_winner

```

### Acceptance Criteria

```txt
External agents can trigger AutoScale workflows without bypassing safety rules.

```

---

# 13. Final End Product Behavior

AutoScale should run like this:

```txt
1. Founder pastes product URL.
2. AutoScale creates product brief.
3. AutoScale studies competitor/niche video evidence.
4. AutoScale creates VideoTrend report.
5. AutoScale generates Video Strategy Score.
6. AutoScale chooses platform mix and posting loadout.
7. AutoScale creates video concepts with trend receipts.
8. AutoScale renders videos.
9. AutoScale quality-checks videos.
10. First run requires manual approval.
11. User enables assisted/full autopilot.
12. AutoScale posts through Postiz.
13. AutoScale tracks clicks, signups, activation, revenue.
14. Compound Engine identifies winners/losers.
15. AutoScale creates variants.
16. Daily Growth Pack keeps the loop running.

```

---

# 14. Build Priority From Current State

## Immediate Priority

```txt
1. Runtime verification
2. Autopilot safety rules UI
3. Trend receipts
4. Video Strategy Score
5. Daily Growth Pack
6. Reference-to-Variant
7. Video Factory quality linter
8. Growth Graph event stream
9. Compound Engine v3
10. Account Health v2
11. API / MCP connector

```

## Do Not Build Yet

```txt
hosted/warmed accounts
account farming
generic creator marketplace
broad LinkedIn/X support
agency workspace
complex billing
AI influencers as the main wedge
native scraping that violates platform rules

```

---

# 15. Cursor Implementation Prompt

Use this as the next instruction to Cursor:

```txt
We are now building AutoScale into a VidGuy-level production system, but differentiated by Product URL intake, VideoTrend intelligence, Growth Graph attribution, and Compound Engine learning.

Current state:
- Growth Run spine exists
- video rendering pipeline exists
- Postiz scheduling exists
- export pack exists
- autopilot cron exists
- tracking exists
- compound classifier exists
- CI passes

Next build order:
1. Verify one complete Growth Run runtime end-to-end.
2. Add Autopilot Rules UI and enforce rules in cron.
3. Add Trend Receipts for every video concept.
4. Add Video Strategy Score.
5. Add Daily Growth Pack.
6. Add Reference-to-Variant workflow.
7. Add Video Quality Linter.
8. Deepen Growth Graph event stream.
9. Upgrade Compound Engine to v3 actions.
10. Add Account Health v2.
11. Add controlled API/MCP connector later.

Important:
Do not build hosted/warmed accounts.
Do not build account farming.
Do not make AI influencers the main wedge.
Do not become a generic AI video generator.

AutoScale wins by being:
Product URL → trend evidence → video strategy → video production → posting → tracking → revenue learning → winner compounding.

```

---

# 16. Quality Bar

AutoScale is ready to sell when:

```txt
A founder pastes a URL.
AutoScale understands the product.
AutoScale shows evidence from the market.
AutoScale creates usable short-form videos.
AutoScale explains why each video exists.
AutoScale posts safely.
AutoScale tracks clicks/signups/revenue.
AutoScale compounds winners automatically.

```

AutoScale is not ready if:

```txt
videos are generic
trend evidence is shallow
autopilot is risky
Postiz scheduling is unreliable
revenue tracking is disconnected
Compound Engine only labels results but does not change future strategy

```

Final standard:

> AutoScale should not just ship videos. It should ship videos that learn what brings users.





# Updated AutoScale Positioning Section

## Final Product Positioning

AutoScale is a trend-aware short-form video growth agent for SaaS founders.

It does not just generate videos.

It finds what is working in a founder’s niche, turns those patterns into short-form video experiments, posts them, tracks what brings users, and compounds the winners.

## Core Positioning Line

Find what works. Ship trend-backed videos. Compound your winners.

## Hero

# Find what works. Ship trend-backed videos. Compound your winners.

Paste your product URL. AutoScale studies your niche, creates TikToks, Reels, and Shorts from proven video patterns, tracks what brings users, and turns your winners into more videos.

[Start Your First Growth Run]

Trend research → Video creation → Posting → Tracking → Winner variants

Built for SaaS founders who need distribution, not another content calendar.

---

## Alternative Hero Options

1. Find what works. Compound it into videos.
2. Ship trend-backed videos that get smarter every week.
3. Turn winning trends into videos for your product.
4. Stop guessing. AutoScale finds what works and compounds your winners.
5. Find the videos that bring users. Then make more of them.
6. Turn trends into videos. Turn winners into a growth loop.
7. AutoScale finds what works in your niche, ships videos, and compounds the winners.

---

## Best Final Hero Hierarchy

Badge:

AI short-form growth agent for SaaS founders

Headline:

Find what works. Ship trend-backed videos. Compound your winners.

Subheadline:

Paste your product URL. AutoScale studies your niche, creates TikToks, Reels, and Shorts from proven video patterns, tracks what brings users, and turns your winners into more videos.

Primary CTA:

Start Your First Growth Run

Secondary CTA:

See how it works

Support Line:

Trend research → Video creation → Posting → Tracking → Winner variants

Positioning Line:

Built for SaaS founders who need distribution, not another content calendar.

---

## Product Explanation

AutoScale helps SaaS founders find winning short-form video patterns, turn them into TikToks, Reels, and Shorts, track what brings users, and compound the winners.

The product is built around one loop:

Trend intelligence → Video creation → Posting → Tracking → Winner variants

The product is not just “AI video generation.”

The product is:

Discover what works.  
Test it through short-form videos.  
Track what brings users.  
Compound the winners.

---

## Messaging Rules

Use:

- videos
- short-form videos
- trend-backed videos
- proven video patterns
- brings users
- compound winners
- growth loop
- video experiments
- SaaS founders

Avoid:

- generic content
- unlimited content
- endlessly
- viral for the sake of viral
- content calendar
- AI content generator
- hop on trends
- spammy autopilot language

---

## Why This Positioning Wins

VidGuy’s lane:

Ship unlimited content on autopilot.

AutoScale’s lane:

Find what works. Ship trend-backed videos. Compound your winners.

VidGuy sells volume.

AutoScale sells intelligent volume.

AutoScale should not compete as another generic AI video factory. It should compete as the system that knows what videos to make, why to make them, how to post them, what to track, and what to compound next.

---

## Landing Page Section Order

1. Hero

Find what works. Ship trend-backed videos. Compound your winners.

1. Problem

SaaS founders do not lose because they lack content ideas. They lose because they guess what to post, cannot tell what brings users, and fail to repeat what works.

1. Solution

AutoScale turns your product URL into a short-form video growth loop.

1. How It Works

Paste URL  
→ AutoScale studies your niche  
→ Finds proven video patterns  
→ Creates TikToks/Reels/Shorts  
→ Posts through your accounts  
→ Tracks what brings users  
→ Compounds your winners

1. Core Features

- Product Intelligence
- VideoTrend Engine
- Trend Receipts
- Video Strategy Score
- Video Factory
- Postiz Publishing
- Tracking and Revenue Events
- Compound Engine
- Daily Growth Pack
- Autopilot Rules

1. Differentiation

Other tools generate content.  
AutoScale finds what works and compounds it into more videos.

1. CTA

Start Your First Growth Run

---

## Cursor Implementation Prompt

Update the landing page and product copy around this final positioning:

Core headline:  
Find what works. Ship trend-backed videos. Compound your winners.

Subheadline:  
Paste your product URL. AutoScale studies your niche, creates TikToks, Reels, and Shorts from proven video patterns, tracks what brings users, and turns your winners into more videos.

CTA:  
Start Your First Growth Run

Support line:  
Trend research → Video creation → Posting → Tracking → Winner variants

Positioning line:  
Built for SaaS founders who need distribution, not another content calendar.

Important:

- Replace generic “content” language with “videos” or “short-form videos.”
- Avoid “unlimited,” “endlessly,” and spammy autopilot language.
- Do not position AutoScale as a generic AI video generator.
- Position AutoScale as a trend-aware short-form video growth agent for SaaS founders.
- Emphasize the loop: find what works, ship videos, track what brings users, compound winners.

Landing page should make this obvious within 5 seconds:  
AutoScale finds winning video patterns in your niche and turns them into a self-improving short-form video growth loop.

