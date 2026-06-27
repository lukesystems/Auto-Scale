-- 0022_metrics_snapshots.sql
-- Post Bridge / provider metrics ingestion history + experiment linkage.

create table if not exists public.metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  growth_experiment_result_id uuid references public.growth_experiment_results(id) on delete set null,
  remote_post_id text,
  platform text not null,
  source text not null check (source in ('postbridge', 'manual', 'tiktok', 'instagram', 'youtube')),
  fetched_at timestamptz not null default now(),
  views bigint check (views is null or views >= 0),
  likes bigint check (likes is null or likes >= 0),
  comments bigint check (comments is null or comments >= 0),
  shares bigint check (shares is null or shares >= 0),
  saves bigint check (saves is null or saves >= 0),
  watch_time_seconds numeric check (watch_time_seconds is null or watch_time_seconds >= 0),
  impressions bigint check (impressions is null or impressions >= 0),
  engagement_rate numeric check (engagement_rate is null or engagement_rate >= 0),
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_metrics_snapshots_schedule_fetched
  on public.metrics_snapshots(schedule_item_id, fetched_at desc);
create index if not exists idx_metrics_snapshots_project_fetched
  on public.metrics_snapshots(project_id, fetched_at desc);
create index if not exists idx_metrics_snapshots_video_fetched
  on public.metrics_snapshots(video_id, fetched_at desc);

alter table public.growth_experiment_results
  add column if not exists latest_metrics_snapshot_id uuid
    references public.metrics_snapshots(id) on delete set null;

alter table public.metrics_snapshots enable row level security;

drop policy if exists "metrics_snapshots project owner all" on public.metrics_snapshots;
create policy "metrics_snapshots project owner all" on public.metrics_snapshots
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = metrics_snapshots.project_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = metrics_snapshots.project_id and p.owner_id = auth.uid()
    )
  );
