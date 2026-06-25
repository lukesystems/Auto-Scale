-- Production job graph: inspectable pipeline per video.
-- scene_plan → storyboard_scenes (extended in 0017)
-- production_assets → generated_assets (extended here)

create table if not exists public.video_production_jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  video_id uuid not null unique references public.videos(id) on delete cascade,
  concept_id uuid not null references public.video_concepts(id) on delete cascade,
  production_mode text check (production_mode is null or production_mode in (
    'fast_slides','demo_short','ai_broll_short','founder_pov','founder_pov_script',
    'reference_remix','ugc_presenter_later'
  )),
  platform_profile text not null default 'tiktok' check (platform_profile in ('tiktok','instagram_reels','youtube_shorts')),
  status text not null default 'queued' check (status in (
    'queued','planning','generating_assets','assembling','quality_check','ready','failed'
  )),
  current_stage text,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_video_production_jobs_run
  on public.video_production_jobs(growth_run_id);
create index if not exists idx_video_production_jobs_status
  on public.video_production_jobs(project_id, status);

drop trigger if exists trg_video_production_jobs_updated_at on public.video_production_jobs;
create trigger trg_video_production_jobs_updated_at
  before update on public.video_production_jobs
  for each row execute function autoscale_set_updated_at();

alter table public.storyboards
  add column if not exists production_job_id uuid references public.video_production_jobs(id) on delete set null;

alter table public.storyboard_scenes
  add column if not exists production_job_id uuid references public.video_production_jobs(id) on delete set null;

alter table public.generated_assets
  add column if not exists production_job_id uuid references public.video_production_jobs(id) on delete set null;

-- Allow founder_pov_script in production_mode on concepts
alter table public.video_concepts drop constraint if exists video_concepts_production_mode_check;
alter table public.video_concepts add constraint video_concepts_production_mode_check check (
  production_mode is null or production_mode in (
    'fast_slides','demo_short','ai_broll_short','founder_pov','founder_pov_script',
    'reference_remix','ugc_presenter_later'
  )
);

alter table public.video_production_jobs enable row level security;

drop policy if exists "video_production_jobs project owner all" on public.video_production_jobs;
create policy "video_production_jobs project owner all" on public.video_production_jobs
  for all using (
    exists (select 1 from public.projects p where p.id = video_production_jobs.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = video_production_jobs.project_id and p.owner_id = auth.uid())
  );
