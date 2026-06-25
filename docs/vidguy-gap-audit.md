# VidGuy Gap Audit — AutoScale vs Production Benchmark

**Benchmark:** [VidGuy](https://www.vidguy.ai/) production flow — mission → strategy → script → voiceover → visual assembly → SFX/music → multi-platform render → review/revision → deploy → track growth.

**AutoScale differentiation:** Product URL + trend evidence + winning format experiments + business-result tracking + winner compounding.

**Audit date:** Repo inspection against `services/`, `app/(app)/projects/`, `supabase/migrations/`. No guessing — file paths cited.

---

## 1. What AutoScale Already Has

### Growth Run spine
| Layer | Files / tables |
|-------|----------------|
| Orchestrator | `services/growth-run/orchestrator.ts` |
| Repository | `services/growth-run/repository.ts` |
| UI hub | `app/(app)/projects/[id]/growth/page.tsx` |
| Run detail | `app/(app)/projects/[id]/growth/[runId]/page.tsx` |
| DB | `growth_runs`, `video_trend_reports`, `video_strategies`, `posting_loadouts` (`0014_growth_run.sql`) |

### Winning Format Lab
| Layer | Files / tables |
|-------|----------------|
| Concepts + fingerprints | `services/video-factory/concepts.ts` |
| Schemas | `services/winning-format/schema.ts` |
| DB | `format_fingerprints`, `controlled_experiments`, `trend_receipts` (`0016_winning_format_lab.sql`) |

### Video Factory
| Layer | Files |
|-------|-------|
| Script | `services/video-factory/script.ts` → `video_scripts` |
| Storyboard + scene plan | `services/video-factory/storyboard.ts`, `scene-plan.ts`, `scene-contract.ts` |
| Render | `services/video-factory/render-concept.ts`, `assembler.ts`, `slide-renderer.ts` |
| Production modes | `services/video-factory/production-modes.ts` |
| Production jobs | `services/video-factory/production-job.ts`, `0018_production_jobs.sql` |
| Render profiles | `services/video-factory/render-profiles.ts` (TikTok, Reels, Shorts) |
| Quality | `services/video-quality/score.ts`, `persist.ts` |
| Revision | `services/video-revision/index.ts` |

### Distribution & tracking
| Layer | Files |
|-------|-------|
| Postiz | `services/postiz/client.ts`, `multi-account.ts`, `skip-log.ts` |
| Export pack | `services/export/growth-run-pack.ts`, `app/api/projects/[id]/growth/[runId]/export/route.ts` |
| Tracked links | `services/tracking/links.ts`, `app/r/[code]/route.ts` |
| Metrics | `video_run_metrics`, `recordMetricsAction` in `growth/actions.ts` |
| Compound | `services/compound/classify.ts`, `materialize-winner.ts` |

### Daily operating surface
| Layer | Files |
|-------|-------|
| Generator | `services/daily-growth-pack/generate.ts` |
| UI | `app/(app)/projects/[id]/growth/daily/page.tsx` (re-exports daily-growth) |
| DB | `daily_growth_packs`, `daily_growth_pack_items` (`0017_engine_v2.sql`) |

### Verification
| Layer | Files |
|-------|-------|
| Harness | `services/growth-run/verify.ts` (15 steps) |
| CLI | `scripts/verify-growth-run.ts`, `npm run verify:growth-run` |
| API | `app/api/dev/verify-growth-run/route.ts` |

### Legacy parallel loop (text posts)
Still present: TrendWatch, Content Conveyor, Approval queue, `generated_posts` — `app/(app)/projects/[id]/trendwatch`, `content`, `approval`, etc.

---

## 2. What Is Wired End-to-End

```
Product brief (pre-existing)
  → startGrowthRun() [orchestrator.ts]
  → VideoTrend report [videotrend/generate.ts]
  → Video strategy + loadout [video-strategy/generate.ts]
  → Concepts + fingerprints + experiments + trend receipts [concepts.ts]
  → Script → storyboard → assets → production job → render [video-factory/index.ts]
  → Quality score persist [video-quality/]
  → Captions per connected account [captions.ts]
  → awaiting_approval [UI: ProductionWorkspace]
  → (manual) scheduleRunAction → Postiz [multi-account.ts]
  → (manual) runCompoundAction [compound/classify.ts]
```

**Production workspace UI** (`components/growth/production-workspace.tsx`) is mounted on the run detail page with agent plan, scene timeline, asset pipeline, trend receipt drawer, quality gate card, and review actions.

**Revision actions** wired: `reviseHookAction`, `reviseSceneTextAction`, `regenerateSceneVisualAction`, `rerenderVideoAction` in `growth/actions.ts`.

---

## 3. What Is Only Stubbed

| Area | Evidence |
|------|----------|
| `demo_short` | `production-modes.ts` — `implemented: false`; `scene-plan.ts` uses `screen_recording` placeholder |
| `ai_broll_short` | Scaffold; fal Seedance in `render-concept.ts` when `FAL_KEY` set, else slide fallback |
| `founder_pov_script`, `reference_remix`, `ugc_presenter_later` | `STUB_MODES` in `production-modes.ts` |
| Voiceover | `voiceover.ts` — fal TTS or silent AAC |
| Music / SFX | `generated_assets.kind: music` exists; `assembler.ts` has no music mux |
| Fal placeholders | `services/media/fal-config.ts` — image/video placeholders throw |
| Autopilot run start | `services/autopilot/run.ts` — does not invoke orchestrator |
| Cron | `app/api/cron/autopilot/route.ts` — auto-approve/schedule only when run exists |

---

## 4. Missing vs VidGuy-Level Production

| VidGuy capability | AutoScale status |
|-------------------|------------------|
| Agentic scriptwriting | ✅ AI scripts (`script.ts`) |
| Voiceover | ⚠️ Partial (fal or silent) |
| Visual assembly | ✅ Slide-first + optional fal clips |
| SFX / music | ❌ Not muxed |
| Multi-platform render files | ⚠️ Profiles exist; one MP4 per concept (not per-platform file variants) |
| Agentic editor / timeline | ⚠️ Production workspace — scene edit + rerender, no trim/SFX UI |
| Review → deploy | ✅ Approve/reject + Postiz or export |
| Growth tracking | ⚠️ Manual metrics + webhooks; no social API ingestion |
| Daily ready pack | ✅ Daily Growth Pack page |
| Warmed accounts | ❌ Intentionally out of scope |

---

## 5. Missing from Video Factory

1. **Real screen capture** for `demo_short` — no screenshot upload pipeline in growth run
2. **Per-platform export variants** — `render-profiles.ts` drives dimensions but does not emit 3 files per concept
3. **Music/SFX track** generation and ffmpeg mix
4. **Thumbnail** generation (`kind: thumbnail` unused)
5. **Guaranteed voice** — silent fallback is not postable quality for many founders
6. **ffmpeg dependency** — without ffmpeg, jobs stay `awaiting_ffmpeg` (`video-factory/index.ts`)

---

## 6. Missing from Review / Revisions

**Built:**
- `services/video-revision/index.ts` — hook, scene text, scene visual, voice, captions, full rerender
- UI buttons in `production-workspace.tsx`

**Still missing vs VidGuy editor:**
- Inline MP4 preview player in workspace
- Trim scene duration
- SFX per scene
- Chat-style revision UX
- Schedule preview modal before Postiz push (preview data exists in `multi-account.ts` return type but not shown in UI)

---

## 7. Missing from Distribution

**Built:**
- Quality gate before schedule (`MIN_SCHEDULE_QUALITY_SCORE = 0.55`)
- Skip reasons logged to `autopilot_skip_log` including `render_failed`, `quality_score_too_low`, `duplicate_hook_risk`, etc.
- Export ZIP with CSV + captions + media URLs

**Gaps:**
- `startGrowthRunAction` passes `connected_account_ids: []` — accounts not bound at run start
- Export pack does not bundle MP4 binaries (URLs only)
- No schedule preview UI on run page
- Orchestrator does not auto-schedule after approval in autopilot mode

---

## 8. Missing from Daily Growth Pack

**Built:** Generator + UI at `/projects/[id]/growth/daily` with 3 videos, 2 hooks, winner variant, pattern to test, format to avoid, posting recommendation.

**Gaps:**
- Regenerates on every page visit (no cron/morning push)
- No one-click approve/schedule from pack items
- No deep links into production workspace per video

---

## 9. Missing from Tracking / Growth Graph

**Built:**
- `tracked_links`, `link_click_events`, `pixel_events`, `signup_events`, `payment_events`
- `video_run_metrics` manual entry on run page
- Compound reads metrics + events (`compound/classify.ts`)

**Gaps:**
- No `/projects/[id]/growth/graph` or analytics dashboard route
- No TikTok/IG/YT automatic metric pull
- Tracked links minted at schedule time, not render time
- Revenue attribution UI absent

---

## 10. Exact Next Implementation Order

Priority: **one real Growth Run → good fast_slides video → quality pass → safe schedule → track → compound winner.**

| # | Task | Files |
|---|------|-------|
| 1 | Apply migrations `0017`, `0018` to Supabase | `supabase/migrations/` |
| 2 | Ensure ffmpeg in deploy environment | ops / CI |
| 3 | Run full growth run locally; fix first `verify:growth-run` failure | `scripts/verify-growth-run.ts` |
| 4 | Wire connected accounts at run start (not `[]`) | `growth/actions.ts`, `orchestrator.ts` |
| 5 | MP4 preview in production workspace | `production-workspace.tsx` |
| 6 | Schedule preview UI before Postiz | `growth/[runId]/page.tsx`, `multi-account.ts` |
| 7 | Auto-schedule + compound when `approval_mode: autopilot` | `orchestrator.ts`, `autopilot/run.ts` |
| 8 | Real fal TTS default (no silent videos) | `voiceover.ts` |
| 9 | Screenshot upload for `demo_short` | new upload action + `scene-plan.ts` |
| 10 | Per-platform render exports (3 MP4s) | `render-concept.ts` |
| 11 | Growth Graph UI | new route + chart over `video_run_metrics` + events |
| 12 | Daily pack actions (approve from pack) | `daily-growth-pack/`, UI |

---

## Summary Matrix

| Area | Built | Wired E2E | Primary gap |
|------|-------|-----------|-------------|
| Growth orchestrator | ✅ | Through approval | Schedule/compound manual |
| fast_slides | ✅ | If ffmpeg + Supabase | Deploy ffmpeg |
| Production job graph | ✅ | `video_production_jobs` | Migration apply |
| Production workspace | ✅ | Run detail page | MP4 preview |
| Render profiles | ✅ | Used in `render-concept.ts` | One file per concept |
| Quality gate | ✅ | Blocks low scores | — |
| Trend receipts | ✅ | Hypothesis label when no evidence | — |
| Revision loop | ✅ | Server + UI buttons | No chat editor |
| Postiz safety | ✅ | Skip reasons + logging | Schedule preview UI |
| Compound actions | ✅ | scale/iterate/kill/inconclusive | Child run auto-start |
| Daily Growth Pack | ✅ | `/growth/daily` | No cron / actions |
| Verify harness | ✅ | 15 steps | — |
| Growth Graph | Partial data | Webhooks only | No UI |
