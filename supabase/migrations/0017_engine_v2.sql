-- Engine v2: production modes, scene contract, video quality scores,
-- daily growth pack, autopilot skip log, compound pause support.

-- Production mode on concepts
alter table public.video_concepts
  add column if not exists production_mode text check (production_mode is null or production_mode in (
    'fast_slides','demo_short','ai_broll_short','founder_pov','reference_remix','ugc_presenter_later'
  ));

-- Scene contract extensions on storyboard_scenes
alter table public.storyboard_scenes
  add column if not exists purpose text check (purpose is null or purpose in (
    'hook','problem','mechanism','proof','demo','cta','outro'
  )),
  add column if not exists scene_type text,
  add column if not exists visual_method text check (visual_method is null or visual_method in (
    'slide','screenshot','screen_recording','ai_broll','founder_clip','ugc_clip'
  )),
  add column if not exists subtitle_text text,
  add column if not exists overlay_text text,
  add column if not exists asset_id uuid references public.generated_assets(id) on delete set null,
  add column if not exists status text not null default 'planned' check (status in (
    'planned','rendering','ready','failed','skipped'
  )),
  add column if not exists error text;

create index if not exists idx_storyboard_scenes_status
  on public.storyboard_scenes(storyboard_id, status);

-- Video quality scores
create table if not exists public.video_quality_scores (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete cascade,
  concept_id uuid references public.video_concepts(id) on delete cascade,
  video_id uuid not null unique references public.videos(id) on delete cascade,
  hook_strength numeric not null default 0 check (hook_strength between 0 and 1),
  clarity numeric not null default 0 check (clarity between 0 and 1),
  pacing numeric not null default 0 check (pacing between 0 and 1),
  text_density numeric not null default 0 check (text_density between 0 and 1),
  cta_strength numeric not null default 0 check (cta_strength between 0 and 1),
  platform_fit numeric not null default 0 check (platform_fit between 0 and 1),
  brand_safety numeric not null default 0 check (brand_safety between 0 and 1),
  duplicate_risk numeric not null default 0 check (duplicate_risk between 0 and 1),
  claim_risk numeric not null default 0 check (claim_risk between 0 and 1),
  overall_score numeric not null default 0 check (overall_score between 0 and 1),
  block_reason text,
  pass_reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_video_quality_scores_run
  on public.video_quality_scores(growth_run_id);
create index if not exists idx_video_quality_scores_overall
  on public.video_quality_scores(project_id, overall_score desc);

-- Format fingerprint pause for kill decisions
alter table public.format_fingerprints
  add column if not exists paused_until timestamptz,
  add column if not exists compound_action text check (compound_action is null or compound_action in (
    'scale','iterate','kill','inconclusive'
  ));

-- Daily Growth Pack
create table if not exists public.daily_growth_packs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  pack_date date not null default (timezone('utc', now()))::date,
  posting_recommendation text,
  metadata jsonb not null default '{}'::jsonb,
  generated_at timestamptz not null default now(),
  unique (project_id, pack_date)
);
create index if not exists idx_daily_growth_packs_project
  on public.daily_growth_packs(project_id, pack_date desc);

create table if not exists public.daily_growth_pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.daily_growth_packs(id) on delete cascade,
  item_type text not null check (item_type in (
    'ready_video','queued_video','trend_hook','winner_variant',
    'pattern_to_test','format_to_avoid','posting_recommendation'
  )),
  title text not null,
  body text,
  reference_id uuid,
  reference_type text,
  priority integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_daily_growth_pack_items_pack
  on public.daily_growth_pack_items(pack_id, priority desc);

-- Autopilot skip log for inspectability
create table if not exists public.autopilot_skip_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid references public.growth_runs(id) on delete set null,
  video_id uuid references public.videos(id) on delete set null,
  connected_account_id uuid references public.connected_accounts(id) on delete set null,
  reason text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_autopilot_skip_log_project
  on public.autopilot_skip_log(project_id, created_at desc);

-- RLS
alter table public.video_quality_scores enable row level security;
alter table public.daily_growth_packs enable row level security;
alter table public.daily_growth_pack_items enable row level security;
alter table public.autopilot_skip_log enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'video_quality_scores','daily_growth_packs','autopilot_skip_log'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists %I on public.%I', t || ' project owner all', t);
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

-- daily_growth_pack_items inherits access via pack
drop policy if exists "daily_growth_pack_items project owner all" on public.daily_growth_pack_items;
create policy "daily_growth_pack_items project owner all" on public.daily_growth_pack_items
  for all using (
    exists (
      select 1 from public.daily_growth_packs dgp
      join public.projects p on p.id = dgp.project_id
      where dgp.id = daily_growth_pack_items.pack_id and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.daily_growth_packs dgp
      join public.projects p on p.id = dgp.project_id
      where dgp.id = daily_growth_pack_items.pack_id and p.owner_id = auth.uid()
    )
  );
