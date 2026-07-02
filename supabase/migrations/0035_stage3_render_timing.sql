-- Stage 3 render timing telemetry.
-- These columns make queue wait, render duration, and current-stage age queryable
-- without parsing JSON metadata.

alter table public.video_production_jobs
  add column if not exists queued_at timestamptz,
  add column if not exists stage_started_at timestamptz,
  add column if not exists render_started_at timestamptz,
  add column if not exists render_completed_at timestamptz,
  add column if not exists render_duration_ms integer;

create index if not exists idx_video_production_jobs_timing
  on public.video_production_jobs(growth_run_id, queued_at, render_started_at, render_completed_at);
