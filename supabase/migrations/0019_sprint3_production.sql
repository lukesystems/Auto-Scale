-- Sprint 3: booking CTAs, managed mode, platform variants, audio library, autopilot logs.

create table if not exists public.project_growth_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,
  operation_mode text not null default 'manual'
    check (operation_mode in ('manual', 'assisted', 'managed')),
  primary_cta_type text not null default 'start_free'
    check (primary_cta_type in (
      'start_free', 'join_waitlist', 'book_demo', 'download_app', 'buy_now', 'custom'
    )),
  booking_url text,
  booking_provider text not null default 'none'
    check (booking_provider in ('google_calendar', 'calendly', 'manual', 'none')),
  default_cta_label text,
  default_cta_url text,
  blocked_topics jsonb not null default '[]'::jsonb,
  blocked_claims jsonb not null default '[]'::jsonb,
  blocked_competitors jsonb not null default '[]'::jsonb,
  distribution_preference text not null default 'all_accounts'
    check (distribution_preference in ('all_accounts', 'selected', 'export_only')),
  selected_account_ids jsonb not null default '[]'::jsonb,
  autopilot_enabled boolean not null default false,
  max_runs_per_day integer not null default 1 check (max_runs_per_day between 0 and 10),
  run_cooldown_hours integer not null default 24 check (run_cooldown_hours between 1 and 168),
  max_active_runs integer not null default 1 check (max_active_runs between 1 and 3),
  onboarding_completed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_project_growth_settings_updated_at on public.project_growth_settings;
create trigger trg_project_growth_settings_updated_at
  before update on public.project_growth_settings
  for each row execute function autoscale_set_updated_at();

alter table public.growth_runs
  add column if not exists distribution_mode text not null default 'postiz'
    check (distribution_mode in ('postiz', 'export_only'));

alter table public.posting_loadouts
  add column if not exists connected_account_ids jsonb not null default '[]'::jsonb,
  add column if not exists distribution_mode text not null default 'postiz'
    check (distribution_mode in ('postiz', 'export_only'));

create table if not exists public.platform_video_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  concept_id uuid not null references public.video_concepts(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  render_profile text not null,
  final_asset_id uuid references public.generated_assets(id) on delete set null,
  public_url text,
  duration_seconds numeric,
  width integer,
  height integer,
  status text not null default 'pending'
    check (status in ('pending', 'rendering', 'ready', 'failed', 'shared')),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (video_id, platform)
);

create index if not exists idx_platform_video_variants_run
  on public.platform_video_variants(growth_run_id);

create table if not exists public.audio_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  source_type text not null
    check (source_type in ('licensed', 'royalty_free', 'uploaded', 'native_platform_reference')),
  provider text,
  title text not null,
  artist text,
  storage_path text,
  file_url text,
  license_status text not null default 'unknown'
    check (license_status in ('cleared', 'royalty_free', 'user_owned', 'reference_only', 'unknown')),
  platform text check (platform is null or platform in ('tiktok', 'instagram', 'youtube')),
  external_sound_id text,
  usage_notes text,
  bpm integer,
  mood text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.audio_placements (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  production_job_id uuid references public.video_production_jobs(id) on delete set null,
  audio_asset_id uuid not null references public.audio_assets(id) on delete cascade,
  placement_type text not null check (placement_type in ('background_music', 'sfx', 'native_reference')),
  volume numeric not null default 0.15 check (volume between 0 and 1),
  start_seconds numeric not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.trending_sound_references (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'instagram', 'youtube')),
  external_sound_id text,
  title text,
  artist text,
  usage_notes text not null default 'Add this native sound manually in the platform app after posting.',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.autopilot_decision_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete set null,
  decision_type text not null,
  outcome text not null,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_autopilot_decision_log_project
  on public.autopilot_decision_log(project_id, created_at desc);

alter table public.tracked_links
  add column if not exists intent_type text default 'product'
    check (intent_type is null or intent_type in ('product', 'demo_intent', 'lead_intent'));

alter table public.schedule_items
  add column if not exists postiz_status text,
  add column if not exists postiz_status_synced_at timestamptz;

alter table public.project_growth_settings enable row level security;
alter table public.platform_video_variants enable row level security;
alter table public.audio_assets enable row level security;
alter table public.audio_placements enable row level security;
alter table public.trending_sound_references enable row level security;
alter table public.autopilot_decision_log enable row level security;

drop policy if exists "project_growth_settings owner" on public.project_growth_settings;
create policy "project_growth_settings owner" on public.project_growth_settings
  for all using (
    exists (select 1 from public.projects p where p.id = project_growth_settings.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = project_growth_settings.project_id and p.owner_id = auth.uid())
  );

drop policy if exists "platform_video_variants owner" on public.platform_video_variants;
create policy "platform_video_variants owner" on public.platform_video_variants
  for all using (
    exists (select 1 from public.projects p where p.id = platform_video_variants.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = platform_video_variants.project_id and p.owner_id = auth.uid())
  );

drop policy if exists "audio_assets owner" on public.audio_assets;
create policy "audio_assets owner" on public.audio_assets
  for all using (
    project_id is null or exists (select 1 from public.projects p where p.id = audio_assets.project_id and p.owner_id = auth.uid())
  ) with check (
    project_id is null or exists (select 1 from public.projects p where p.id = audio_assets.project_id and p.owner_id = auth.uid())
  );

drop policy if exists "audio_placements owner" on public.audio_placements;
create policy "audio_placements owner" on public.audio_placements
  for all using (
    exists (
      select 1 from public.videos v
      join public.projects p on p.id = v.project_id
      where v.id = audio_placements.video_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.videos v
      join public.projects p on p.id = v.project_id
      where v.id = audio_placements.video_id and p.owner_id = auth.uid()
    )
  );

drop policy if exists "trending_sound_references owner" on public.trending_sound_references;
create policy "trending_sound_references owner" on public.trending_sound_references
  for all using (
    exists (select 1 from public.projects p where p.id = trending_sound_references.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = trending_sound_references.project_id and p.owner_id = auth.uid())
  );

drop policy if exists "autopilot_decision_log owner" on public.autopilot_decision_log;
create policy "autopilot_decision_log owner" on public.autopilot_decision_log
  for all using (
    exists (select 1 from public.projects p where p.id = autopilot_decision_log.project_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from public.projects p where p.id = autopilot_decision_log.project_id and p.owner_id = auth.uid())
  );
