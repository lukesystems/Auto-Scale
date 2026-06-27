# Metrics ingestion (Post Bridge)

AutoScale ingests short-form video performance metrics through the **Post Bridge API** when `PUBLISHING_PROVIDER=postbridge`. Manual entry on the Growth Run schedule panel still works and writes the same `metrics_snapshots` history.

## Architecture

```txt
schedule_items (posted, postiz_post_id)
  → metrics-ingestion adapter (Post Bridge)
  → metrics_snapshots (history)
  → video_run_metrics (latest rollup for Compound)
  → growth_experiment_results.metric_summary + latest_metrics_snapshot_id
```

Module: `services/metrics-ingestion/`

| File | Role |
|------|------|
| `types.ts` | `MetricsSnapshot`, adapter interfaces |
| `postbridge-adapter.ts` | Primary adapter — Post Bridge analytics |
| `run-ingestion.ts` | Per-item / per-project orchestration |
| `schedule.ts` | `runDueMetricsIngestion()` for cron |
| `persist.ts` | Shared DB writes (auto + manual) |

## Post Bridge API endpoints used

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/posts/{id}` | Resolve post status, `post_results[]`, embedded metrics fallback |
| `GET /v1/analytics` | Primary metrics source (`platform`, `post_result_id[]`, `timeframe`) |
| `POST /v1/analytics/sync` | Best-effort refresh before read (rate-limited ~1/5min) |

**Auth:** `Authorization: Bearer <API_KEY>`  
**Rate limit:** ~10 req/s per key (per Post Bridge docs)

### Field mapping

| Post Bridge | `MetricsSnapshot` | Notes |
|-------------|-------------------|-------|
| `view_count` / `views` | `views` | Usually available |
| `like_count` / `likes` | `likes` | Usually available |
| `comment_count` / `comments` | `comments` | Usually available |
| `share_count` / `shares` | `shares` | Platform-dependent |
| `save_count` / `saves` | `saves` | Platform-dependent |
| `impression_count` / `impressions` | `impressions` | Often null on TikTok/Reels |
| `watch_time_seconds` / `duration` | `watchTimeSeconds` | **Gap:** not consistently exposed; may be null |
| — | `engagementRate` | Computed: `(likes+comments+shares+saves)/views` |

`schedule_items.postiz_post_id` stores the Post Bridge **post id** (same column name as Postiz for compatibility). The adapter resolves `post_result_id` from `GET /v1/posts/{id}` → `post_results[]` before calling analytics.

## Environment

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLISHING_PROVIDER` | Yes | Set to `postbridge` |
| `POST_BRIDGE_API_KEY` | Managed mode | Or BYOK via `postbridge_connections` |
| `POST_BRIDGE_API_URL` | No | Defaults to `https://api.post-bridge.com/v1` |
| `AUTOSCALE_CRON_SECRET` or `CRON_SECRET` | Cron | Secures `/api/cron/metrics-ingestion` |

## Cron

- Route: `POST|GET /api/cron/metrics-ingestion`
- Header: `Authorization: Bearer <AUTOSCALE_CRON_SECRET>`
- Schedule: daily `0 6 * * *` in `vercel.json`
- Window: posted items with remote id in last **30 days**

Autopilot (`services/autopilot/run.ts`) also runs a non-blocking per-project ingestion pass after Postiz/Post Bridge status sync.

## Local testing

1. Apply migration: `0022_metrics_snapshots.sql`
2. Set `PUBLISHING_PROVIDER=postbridge` and configure API key
3. Ensure a `schedule_items` row is `posted` with `postiz_post_id` set
4. Run ingestion:

```bash
# In a server context or temporary script:
npx tsx -e "import { ingestMetricsForScheduleItem } from './services/metrics-ingestion/run-ingestion'; ingestMetricsForScheduleItem('<schedule-item-uuid>').then(console.log)"
```

Or trigger cron locally:

```bash
curl -X POST http://localhost:3000/api/cron/metrics-ingestion \
  -H "Authorization: Bearer $AUTOSCALE_CRON_SECRET"
```

5. Open Growth Run detail → Schedule panel → **Auto-synced via Post Bridge** badge + **Last synced**

## Tests

```bash
npm run test -- __tests__/metrics-ingestion-postbridge.test.ts __tests__/metrics-ingestion-run.test.ts
```
