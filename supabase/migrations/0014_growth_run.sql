-- ============================================================================
-- AutoScale v1 — Growth Run spine
-- Pivots AutoScale into an autonomous short-form video growth engine.
-- Adds the closed loop:
--   product brief → video trend report → video strategy → posting loadout
--   → video concepts → scripts → storyboards → generated assets → videos
--   → captions → schedule items (Postiz multi-account) → tracked links
--   → owned-side events (clicks/pixel/signup/payment) + manual metrics
--   → experiment results → winner variants / kill decisions
--   → learning memory → next growth run
-- All tables RLS'd by projects.owner_id = auth.uid().
-- Reuses pre-existing: projects, product_briefs, competitors, video_evidence,
-- video_patterns. Does not modify legacy content tables.
-- ============================================================================

-- ---------- Growth Run ------------------------------------------------------

create table if not exists public.growth_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending' check (status in (
    'pending','running','awaiting_approval','scheduled','live','completed','failed','cancelled'
  )),
  trigger text not null default 'manual' check (trigger in ('manual','autopilot','scheduled')),
  approval_mode text not null default 'manual' check (approval_mode in (
    'manual','per_format','autopilot'
  )),
  posting_aggressiveness text not null default 'balanced' check (posting_aggressiveness in (
    'conservative','balanced','aggressive'
  )),
  brand_constraints jsonb not null default '{}'::jsonb,
  target_platforms jsonb not null default '["tiktok","instagram","youtube"]'::jsonb,
  phase text not null default 'brief' check (phase in (
    'brief','videotrend','strategy','loadout','concepts','scripts','storyboards',
    'assets','videos','captions','approval','schedule','live','compound','done'
  )),
  phase_status jsonb not null default '{}'::jsonb,
  options jsonb not null default '{}'::jsonb,
  error text,
  notes text,
  parent_run_id uuid references public.growth_runs(id) on delete set null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_growth_runs_project on public.growth_runs(project_id);
create index if not exists idx_growth_runs_status on public.growth_runs(status);
drop trigger if exists trg_growth_runs_updated_at on public.growth_runs;
create trigger trg_growth_runs_updated_at
  before update on public.growth_runs
  for each row execute function autoscale_set_updated_at();

-- ---------- VideoTrend report ----------------------------------------------

create table if not exists public.video_trend_reports (
  id uuid primary key default gen_random_uuid(),
  growth_run_id uuid not null unique references public.growth_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  winning_structures jsonb not null default '[]'::jsonb,
  hook_patterns jsonb not null default '[]'::jsonb,
  opening_frames jsonb not null default '[]'::jsonb,
  cta_patterns jsonb not null default '[]'::jsonb,
  audience_language jsonb not null default '[]'::jsonb,
  platform_patterns jsonb not null default '{}'::jsonb,
  recommended_experiments jsonb not null default '[]'::jsonb,
  competitor_gaps jsonb not null default '[]'::jsonb,
  repurposable_formats jsonb not null default '[]'::jsonb,
  evidence_video_ids jsonb not null default '[]'::jsonb,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_video_trend_reports_project on public.video_trend_reports(project_id);

-- ---------- Video Strategy + Posting Loadout -------------------------------

create table if not exists public.video_strategies (
  id uuid primary key default gen_random_uuid(),
  growth_run_id uuid not null unique references public.growth_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform_mix jsonb not null default '{}'::jsonb,
  video_type_mix jsonb not null default '{}'::jsonb,
  campaign_hypotheses jsonb not null default '[]'::jsonb,
  rationale text,
  created_at timestamptz not null default now()
);
create index if not exists idx_video_strategies_project on public.video_strategies(project_id);

create table if not exists public.posting_loadouts (
  id uuid primary key default gen_random_uuid(),
  growth_run_id uuid not null unique references public.growth_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  per_account_plan jsonb not null default '[]'::jsonb,
  total_videos_planned integer not null default 0,
  duration_days integer not null default 7,
  created_at timestamptz not null default now()
);
create index if not exists idx_posting_loadouts_project on public.posting_loadouts(project_id);

-- ---------- Connected Accounts (multi-account posting) ---------------------

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null check (platform in ('tiktok','instagram','youtube')),
  handle text not null,
  display_name text,
  postiz_account_id text,
  postiz_provider_id text,
  status text not null default 'active' check (status in ('active','paused','disconnected','flagged')),
  max_posts_per_day integer not null default 4 check (max_posts_per_day >= 0),
  min_minutes_between_posts integer not null default 90 check (min_minutes_between_posts >= 0),
  persona text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, platform, handle)
);
create index if not exists idx_connected_accounts_project on public.connected_accounts(project_id);
drop trigger if exists trg_connected_accounts_updated_at on public.connected_accounts;
create trigger trg_connected_accounts_updated_at
  before update on public.connected_accounts
  for each row execute function autoscale_set_updated_at();

create table if not exists public.account_health_log (
  id uuid primary key default gen_random_uuid(),
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  event text not null,
  severity text not null default 'info' check (severity in ('info','warn','critical')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_account_health_log_account on public.account_health_log(connected_account_id, created_at desc);

-- ---------- Video concepts → scripts → storyboards -------------------------

create table if not exists public.video_concepts (
  id uuid primary key default gen_random_uuid(),
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  video_type text not null check (video_type in (
    'slide','demo','founder_pov','pain_led','trend_remix','ai_broll','objection','comparison'
  )),
  platform text not null check (platform in ('tiktok','instagram','youtube')),
  target_length_seconds integer not null default 22 check (target_length_seconds > 0),
  hook text not null,
  angle text,
  promise text,
  cta text,
  hypothesis text,
  source_pattern_id uuid references public.video_patterns(id) on delete set null,
  evidence_video_ids jsonb not null default '[]'::jsonb,
  status text not null default 'draft' check (status in ('draft','scripted','approved','killed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_video_concepts_run on public.video_concepts(growth_run_id);
create index if not exists idx_video_concepts_project on public.video_concepts(project_id);
drop trigger if exists trg_video_concepts_updated_at on public.video_concepts;
create trigger trg_video_concepts_updated_at
  before update on public.video_concepts
  for each row execute function autoscale_set_updated_at();

create table if not exists public.video_scripts (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null unique references public.video_concepts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  hook_line text not null,
  body_lines jsonb not null default '[]'::jsonb,
  cta_line text,
  voiceover_full text,
  on_screen_text jsonb not null default '[]'::jsonb,
  total_words integer not null default 0,
  estimated_duration_seconds integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_video_scripts_updated_at on public.video_scripts;
create trigger trg_video_scripts_updated_at
  before update on public.video_scripts
  for each row execute function autoscale_set_updated_at();

create table if not exists public.storyboards (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null unique references public.video_concepts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  aspect_ratio text not null default '9:16',
  total_duration_seconds integer not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
drop trigger if exists trg_storyboards_updated_at on public.storyboards;
create trigger trg_storyboards_updated_at
  before update on public.storyboards
  for each row execute function autoscale_set_updated_at();

create table if not exists public.storyboard_scenes (
  id uuid primary key default gen_random_uuid(),
  storyboard_id uuid not null references public.storyboards(id) on delete cascade,
  scene_index integer not null,
  role text not null check (role in ('hook','context','demo','proof','cta','outro','transition')),
  duration_seconds numeric not null default 2 check (duration_seconds > 0),
  visual_intent text not null,
  on_screen_text text,
  voiceover_line text,
  asset_method text not null default 'slide'
    check (asset_method in ('slide','fal_clip','screen_demo','stock','image','user_upload')),
  asset_prompt text,
  metadata jsonb not null default '{}'::jsonb,
  unique (storyboard_id, scene_index)
);
create index if not exists idx_storyboard_scenes_storyboard on public.storyboard_scenes(storyboard_id);

-- ---------- Generated assets + final videos --------------------------------

create table if not exists public.generated_assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete set null,
  concept_id uuid references public.video_concepts(id) on delete cascade,
  scene_id uuid references public.storyboard_scenes(id) on delete cascade,
  kind text not null check (kind in (
    'slide_image','fal_clip','voiceover','subtitle','music','final_mp4','thumbnail'
  )),
  provider text,
  provider_request_id text,
  storage_path text,
  public_url text,
  duration_seconds numeric,
  status text not null default 'pending' check (status in ('pending','running','succeeded','failed','skipped')),
  error text,
  cost_cents integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_generated_assets_concept on public.generated_assets(concept_id);
create index if not exists idx_generated_assets_run on public.generated_assets(growth_run_id);
drop trigger if exists trg_generated_assets_updated_at on public.generated_assets;
create trigger trg_generated_assets_updated_at
  before update on public.generated_assets
  for each row execute function autoscale_set_updated_at();

create table if not exists public.videos (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null unique references public.video_concepts(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  final_asset_id uuid references public.generated_assets(id) on delete set null,
  thumbnail_asset_id uuid references public.generated_assets(id) on delete set null,
  duration_seconds numeric,
  aspect_ratio text not null default '9:16',
  status text not null default 'pending' check (status in (
    'pending','rendering','ready','approved','rejected','killed','posted','failed'
  )),
  approval_status text not null default 'pending_review' check (approval_status in (
    'pending_review','approved','rejected','auto_approved'
  )),
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  hash_signature text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_videos_run on public.videos(growth_run_id);
create index if not exists idx_videos_status on public.videos(status);
drop trigger if exists trg_videos_updated_at on public.videos;
create trigger trg_videos_updated_at
  before update on public.videos
  for each row execute function autoscale_set_updated_at();

create table if not exists public.video_captions (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references public.videos(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  connected_account_id uuid references public.connected_accounts(id) on delete set null,
  platform text not null check (platform in ('tiktok','instagram','youtube')),
  caption text not null,
  hashtags jsonb not null default '[]'::jsonb,
  cta text,
  variation_seed text,
  variation_score numeric not null default 0 check (variation_score between 0 and 1),
  created_at timestamptz not null default now()
);
create index if not exists idx_video_captions_video on public.video_captions(video_id);

-- ---------- Schedule items (Postiz multi-account) --------------------------

create table if not exists public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  caption_id uuid references public.video_captions(id) on delete set null,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  platform text not null check (platform in ('tiktok','instagram','youtube')),
  scheduled_for timestamptz not null,
  status text not null default 'queued' check (status in (
    'queued','approved','sending','scheduled','posted','failed','cancelled','retrying'
  )),
  postiz_post_id text,
  postiz_payload jsonb not null default '{}'::jsonb,
  postiz_response jsonb not null default '{}'::jsonb,
  posted_url text,
  posted_at timestamptz,
  failure_reason text,
  retry_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_schedule_items_run on public.schedule_items(growth_run_id);
create index if not exists idx_schedule_items_account_time on public.schedule_items(connected_account_id, scheduled_for);
create index if not exists idx_schedule_items_status on public.schedule_items(status);
drop trigger if exists trg_schedule_items_updated_at on public.schedule_items;
create trigger trg_schedule_items_updated_at
  before update on public.schedule_items
  for each row execute function autoscale_set_updated_at();

-- ---------- Tracking: tracked links + owned-side events --------------------

create table if not exists public.tracked_links (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  schedule_item_id uuid references public.schedule_items(id) on delete set null,
  connected_account_id uuid references public.connected_accounts(id) on delete set null,
  short_code text not null unique,
  destination_url text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  click_count bigint not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_tracked_links_project on public.tracked_links(project_id);
create index if not exists idx_tracked_links_video on public.tracked_links(video_id);

create table if not exists public.link_click_events (
  id uuid primary key default gen_random_uuid(),
  tracked_link_id uuid not null references public.tracked_links(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  user_agent text,
  referrer text,
  ip_hash text,
  country text,
  created_at timestamptz not null default now()
);
create index if not exists idx_link_click_events_link on public.link_click_events(tracked_link_id, created_at desc);

create table if not exists public.pixel_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tracked_link_id uuid references public.tracked_links(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  event_name text not null,
  session_id text,
  visitor_hash text,
  url text,
  referrer text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_pixel_events_project_event on public.pixel_events(project_id, event_name, created_at desc);
create index if not exists idx_pixel_events_video on public.pixel_events(video_id);

create table if not exists public.signup_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tracked_link_id uuid references public.tracked_links(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  external_user_id text,
  email_hash text,
  source text not null default 'webhook' check (source in ('webhook','pixel','manual','api')),
  activated boolean not null default false,
  activated_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_signup_events_project on public.signup_events(project_id, created_at desc);
create index if not exists idx_signup_events_video on public.signup_events(video_id);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  tracked_link_id uuid references public.tracked_links(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  signup_event_id uuid references public.signup_events(id) on delete set null,
  amount_cents integer not null default 0,
  currency text not null default 'USD',
  external_payment_id text,
  source text not null default 'webhook' check (source in ('webhook','manual','api')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_events_project on public.payment_events(project_id, created_at desc);
create index if not exists idx_payment_events_video on public.payment_events(video_id);

-- ---------- Manual / aggregated metrics per schedule item ------------------

create table if not exists public.video_run_metrics (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  schedule_item_id uuid not null references public.schedule_items(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','platform_api','derived')),
  views bigint check (views is null or views >= 0),
  watch_time_seconds bigint check (watch_time_seconds is null or watch_time_seconds >= 0),
  completion_rate numeric check (completion_rate is null or completion_rate between 0 and 1),
  three_sec_hold_rate numeric check (three_sec_hold_rate is null or three_sec_hold_rate between 0 and 1),
  likes bigint, comments bigint, shares bigint, saves bigint, profile_visits bigint,
  link_clicks bigint, signups bigint, activated_users bigint, paid_users bigint, revenue_cents bigint,
  captured_at timestamptz not null default now(),
  notes text,
  metadata jsonb not null default '{}'::jsonb
);
create index if not exists idx_video_run_metrics_schedule on public.video_run_metrics(schedule_item_id, captured_at desc);
create index if not exists idx_video_run_metrics_video on public.video_run_metrics(video_id, captured_at desc);

-- ---------- Compound engine: classification → variants / kill --------------

create table if not exists public.growth_experiment_results (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  video_id uuid not null references public.videos(id) on delete cascade,
  classification text not null check (classification in (
    'winner','weak_hook','weak_cta','wrong_audience','message_mismatch','loser','inconclusive'
  )),
  diagnosis text,
  metric_summary jsonb not null default '{}'::jsonb,
  next_action text not null default 'review' check (next_action in (
    'variant','rewrite_hook','rewrite_cta','retarget','kill','increase_volume','review'
  )),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  created_at timestamptz not null default now()
);
create index if not exists idx_growth_experiment_results_run on public.growth_experiment_results(growth_run_id);

create table if not exists public.winner_variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  source_video_id uuid not null references public.videos(id) on delete cascade,
  experiment_result_id uuid references public.growth_experiment_results(id) on delete set null,
  variant_type text not null check (variant_type in (
    'hook_swap','cta_swap','length_swap','format_swap','angle_swap','platform_repurpose'
  )),
  variant_brief jsonb not null default '{}'::jsonb,
  spawned_concept_id uuid references public.video_concepts(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','generated','approved','live','killed')),
  created_at timestamptz not null default now()
);
create index if not exists idx_winner_variants_run on public.winner_variants(growth_run_id);

create table if not exists public.kill_decisions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete cascade,
  video_id uuid references public.videos(id) on delete cascade,
  scope text not null check (scope in ('video','format','hook','platform','account')),
  scope_value text,
  reason text not null,
  metric_evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_kill_decisions_project on public.kill_decisions(project_id);

-- ---------- Autopilot rules + learning memory ------------------------------

create table if not exists public.autopilot_rules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  rule_type text not null check (rule_type in (
    'generation_volume','posting_cadence','approval','variant_spawn','kill','volume_adjust','account_health'
  )),
  trigger jsonb not null default '{}'::jsonb,
  action jsonb not null default '{}'::jsonb,
  priority integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_autopilot_rules_project on public.autopilot_rules(project_id);
drop trigger if exists trg_autopilot_rules_updated_at on public.autopilot_rules;
create trigger trg_autopilot_rules_updated_at
  before update on public.autopilot_rules
  for each row execute function autoscale_set_updated_at();

create table if not exists public.learning_memory (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete set null,
  kind text not null check (kind in (
    'format_performance','hook_performance','cta_performance','platform_performance',
    'audience_signal','account_signal','timing_signal','generic'
  )),
  key text not null,
  value jsonb not null default '{}'::jsonb,
  weight numeric not null default 1,
  evidence_count integer not null default 1,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (project_id, kind, key)
);
create index if not exists idx_learning_memory_project_kind on public.learning_memory(project_id, kind);

-- ---------- Row-Level Security ---------------------------------------------

alter table public.growth_runs              enable row level security;
alter table public.video_trend_reports      enable row level security;
alter table public.video_strategies         enable row level security;
alter table public.posting_loadouts         enable row level security;
alter table public.connected_accounts       enable row level security;
alter table public.account_health_log       enable row level security;
alter table public.video_concepts           enable row level security;
alter table public.video_scripts            enable row level security;
alter table public.storyboards              enable row level security;
alter table public.storyboard_scenes        enable row level security;
alter table public.generated_assets         enable row level security;
alter table public.videos                   enable row level security;
alter table public.video_captions           enable row level security;
alter table public.schedule_items           enable row level security;
alter table public.tracked_links            enable row level security;
alter table public.link_click_events        enable row level security;
alter table public.pixel_events             enable row level security;
alter table public.signup_events            enable row level security;
alter table public.payment_events           enable row level security;
alter table public.video_run_metrics        enable row level security;
alter table public.growth_experiment_results enable row level security;
alter table public.winner_variants          enable row level security;
alter table public.kill_decisions           enable row level security;
alter table public.autopilot_rules          enable row level security;
alter table public.learning_memory          enable row level security;

-- Helper macro pattern: project-owner policy. We expand per table since
-- Postgres has no policy macros.

do $$
declare
  t text;
  tables text[] := array[
    'growth_runs','video_trend_reports','video_strategies','posting_loadouts',
    'connected_accounts','account_health_log','video_concepts','video_scripts',
    'storyboards','generated_assets','videos','video_captions','schedule_items',
    'tracked_links','link_click_events','pixel_events','signup_events',
    'payment_events','video_run_metrics','growth_experiment_results',
    'winner_variants','kill_decisions','autopilot_rules','learning_memory'
  ];
begin
  foreach t in array tables loop
    execute format(
      'drop policy if exists %I on public.%I',
      t || ' project owner all',
      t
    );
    execute format($f$
      create policy "%1$s project owner all" on public.%1$I
        for all using (
          exists (select 1 from public.projects p
                  where p.id = %1$I.project_id and p.owner_id = auth.uid())
        ) with check (
          exists (select 1 from public.projects p
                  where p.id = %1$I.project_id and p.owner_id = auth.uid())
        );
    $f$, t);
  end loop;
end $$;

-- storyboard_scenes has no project_id column; scope via parent storyboard.
drop policy if exists "storyboard_scenes via storyboard" on public.storyboard_scenes;
create policy "storyboard_scenes via storyboard" on public.storyboard_scenes
  for all using (
    exists (
      select 1 from public.storyboards sb
      join public.projects p on p.id = sb.project_id
      where sb.id = storyboard_scenes.storyboard_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.storyboards sb
      join public.projects p on p.id = sb.project_id
      where sb.id = storyboard_scenes.storyboard_id and p.owner_id = auth.uid()
    )
  );

-- Public-facing event ingest paths (pixel + tracked-link clicks) need
-- insert via service-role; reads stay project-scoped above. We leave them
-- write-restricted to authenticated owners + the service role bypasses RLS.
