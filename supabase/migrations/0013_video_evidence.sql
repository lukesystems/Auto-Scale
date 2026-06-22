-- Phase 6A: API-free public short-form video evidence.

create table if not exists public.video_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  competitor_id uuid references public.competitors(id) on delete set null,
  source_candidate_id uuid references public.source_candidates(id) on delete set null,
  platform text not null default 'other'
    check (platform in ('tiktok', 'instagram', 'youtube', 'other')),
  video_url text not null,
  canonical_url text not null,
  account_handle text,
  account_url text,
  caption text,
  title text,
  hashtags jsonb not null default '[]'::jsonb,
  sound text,
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  view_count bigint check (view_count is null or view_count >= 0),
  like_count bigint check (like_count is null or like_count >= 0),
  comment_count bigint check (comment_count is null or comment_count >= 0),
  share_count bigint check (share_count is null or share_count >= 0),
  posted_at timestamptz,
  linked_urls jsonb not null default '[]'::jsonb,
  detected_hook text,
  detected_cta text,
  format_guess text not null default 'unknown',
  topic_guess text,
  source_confidence numeric not null default 0 check (source_confidence between 0 and 1),
  fetch_status text not null default 'pending'
    check (fetch_status in ('pending', 'success', 'failed', 'skipped')),
  fetch_method text not null default 'safe_public_html',
  raw_source_type text not null default 'video'
    check (raw_source_type in ('video', 'profile', 'unknown')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_video_evidence_project_platform
  on public.video_evidence(project_id, platform);
create index if not exists idx_video_evidence_project_competitor
  on public.video_evidence(project_id, competitor_id);
create index if not exists idx_video_evidence_project_canonical
  on public.video_evidence(project_id, canonical_url);
create unique index if not exists idx_video_evidence_project_canonical_unique
  on public.video_evidence(project_id, canonical_url);

create table if not exists public.video_metrics_snapshots (
  id uuid primary key default gen_random_uuid(),
  video_evidence_id uuid not null references public.video_evidence(id) on delete cascade,
  view_count bigint check (view_count is null or view_count >= 0),
  like_count bigint check (like_count is null or like_count >= 0),
  comment_count bigint check (comment_count is null or comment_count >= 0),
  share_count bigint check (share_count is null or share_count >= 0),
  captured_at timestamptz not null default now()
);

create index if not exists idx_video_metrics_evidence_captured
  on public.video_metrics_snapshots(video_evidence_id, captured_at desc);

create table if not exists public.video_patterns (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  pattern_type text not null check (pattern_type in ('hook', 'format', 'cta', 'topic', 'cadence', 'link')),
  label text not null,
  description text,
  evidence_count integer not null default 0 check (evidence_count >= 0),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_video_patterns_project_type
  on public.video_patterns(project_id, pattern_type);

drop trigger if exists trg_video_evidence_updated_at on public.video_evidence;
create trigger trg_video_evidence_updated_at
  before update on public.video_evidence
  for each row execute function autoscale_set_updated_at();

alter table public.video_evidence enable row level security;
alter table public.video_metrics_snapshots enable row level security;
alter table public.video_patterns enable row level security;

create policy "video_evidence project owner all" on public.video_evidence
  for all using (
    exists (select 1 from public.projects p where p.id = video_evidence.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = video_evidence.project_id and p.owner_id = auth.uid())
  );

create policy "video_metrics_snapshots project owner all" on public.video_metrics_snapshots
  for all using (
    exists (
      select 1 from public.video_evidence v
      join public.projects p on p.id = v.project_id
      where v.id = video_metrics_snapshots.video_evidence_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.video_evidence v
      join public.projects p on p.id = v.project_id
      where v.id = video_metrics_snapshots.video_evidence_id and p.owner_id = auth.uid()
    )
  );

create policy "video_patterns project owner all" on public.video_patterns
  for all using (
    exists (select 1 from public.projects p where p.id = video_patterns.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = video_patterns.project_id and p.owner_id = auth.uid())
  );
