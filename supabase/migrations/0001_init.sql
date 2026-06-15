-- ============================================================================
-- AutoScale V1 — Initial schema
-- Protects the core data chain:
--   source → insight → hook → content idea → generated post → scheduled post
--          → experiment → metric → winner → variant → learning
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------- Helpers --------------------------------------------------------

create or replace function autoscale_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------- Profiles --------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  subscription_status text not null default 'free',
  plan text not null default 'starter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function autoscale_set_updated_at();

-- Sync auth.users → public.profiles on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Plans / billing scaffolding ------------------------------------

create table if not exists public.plans (
  id text primary key,
  name text not null,
  price_monthly numeric,
  limits jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

insert into public.plans (id, name, price_monthly, limits) values
  ('starter',  'Starter',  49,  '{"projects":1,"trendwatch_runs_per_month":1,"content_ideas_per_month":30,"posts_per_month":10}'),
  ('growth',   'Growth',   149, '{"projects":3,"trendwatch_runs_per_month":4,"content_ideas_per_month":120,"posts_per_month":40}'),
  ('operator', 'Operator', 399, '{"projects":10,"trendwatch_runs_per_month":30,"content_ideas_per_month":1000,"posts_per_month":300}')
on conflict (id) do nothing;

create table if not exists public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null default date_trunc('month', now())::date,
  period_end date not null default (date_trunc('month', now()) + interval '1 month')::date,
  trendwatch_runs int not null default 0,
  content_ideas int not null default 0,
  generated_posts int not null default 0,
  ai_tokens bigint not null default 0,
  unique (owner_id, period_start)
);

-- ---------- Projects --------------------------------------------------------

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text,
  niche text,
  product_url text,
  description text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_projects_owner on public.projects(owner_id);
create trigger trg_projects_updated_at
  before update on public.projects
  for each row execute function autoscale_set_updated_at();

-- ---------- Product briefs --------------------------------------------------

create table if not exists public.product_briefs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  product_summary text,
  target_customer text,
  primary_pain text,
  core_promise text,
  offer text,
  cta text,
  competitors jsonb not null default '[]'::jsonb,
  content_pillars jsonb not null default '[]'::jsonb,
  positioning_angles jsonb not null default '[]'::jsonb,
  production_constraints jsonb not null default '{}'::jsonb,
  brand_voice text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_product_briefs_updated_at
  before update on public.product_briefs
  for each row execute function autoscale_set_updated_at();

-- ---------- Competitors -----------------------------------------------------

create table if not exists public.competitors (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  url text,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitors_project on public.competitors(project_id);

create table if not exists public.competitor_accounts (
  id uuid primary key default gen_random_uuid(),
  competitor_id uuid references public.competitors(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null,
  handle text not null,
  url text,
  account_type text not null default 'unknown',
  follower_count bigint,
  created_at timestamptz not null default now()
);
create index if not exists idx_competitor_accounts_project on public.competitor_accounts(project_id);

-- ---------- TrendWatch ------------------------------------------------------

create table if not exists public.trendwatch_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending',
  notes text,
  source_count int not null default 0,
  insight_count int not null default 0,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_trendwatch_runs_project on public.trendwatch_runs(project_id);

create table if not exists public.trendwatch_sources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid references public.trendwatch_runs(id) on delete set null,
  source_url text,
  platform text not null default 'other',
  account_handle text,
  account_type text not null default 'unknown',
  follower_count bigint,
  views bigint,
  likes bigint,
  saves bigint,
  shares bigint,
  comments bigint,
  format text,
  hook text,
  angle text,
  visual_pattern text,
  cta_pattern text,
  audience_pain text,
  why_it_worked text,
  how_to_adapt text,
  distortion_risk text not null default 'medium',
  transferability_score numeric not null default 0,
  signal_score numeric not null default 0,
  notes text,
  screenshot_url text,
  created_at timestamptz not null default now()
);
create index if not exists idx_trendwatch_sources_project on public.trendwatch_sources(project_id);
create index if not exists idx_trendwatch_sources_run on public.trendwatch_sources(run_id);

create table if not exists public.trendwatch_insights (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  run_id uuid references public.trendwatch_runs(id) on delete set null,
  source_id uuid references public.trendwatch_sources(id) on delete set null,
  insight text not null,
  format text,
  hook_pattern text,
  angle text,
  audience text,
  signal_score numeric not null default 0,
  recommended_experiment text,
  created_at timestamptz not null default now()
);
create index if not exists idx_trendwatch_insights_project on public.trendwatch_insights(project_id);
create index if not exists idx_trendwatch_insights_run on public.trendwatch_insights(run_id);

-- ---------- Hooks + Ideas + Posts ------------------------------------------

create table if not exists public.hooks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  insight_id uuid references public.trendwatch_insights(id) on delete set null,
  hook text not null,
  angle text,
  format_hint text,
  target_audience text,
  created_at timestamptz not null default now()
);
create index if not exists idx_hooks_project on public.hooks(project_id);

create table if not exists public.content_ideas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  insight_id uuid references public.trendwatch_insights(id) on delete set null,
  hook_id uuid references public.hooks(id) on delete set null,
  format text,
  hook text,
  angle text,
  target_audience text,
  why_this_should_work text,
  hypothesis text,
  platforms jsonb not null default '[]'::jsonb,
  metric_to_watch text,
  risk_level text not null default 'medium',
  variant_suggestions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_content_ideas_project on public.content_ideas(project_id);

create table if not exists public.generated_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  content_idea_id uuid references public.content_ideas(id) on delete set null,
  insight_id uuid references public.trendwatch_insights(id) on delete set null,
  format text,
  platform text,
  hook text,
  angle text,
  target_audience text,
  hypothesis text,
  caption text,
  cta text,
  metric_to_watch text,
  status text not null default 'draft',
  quality_score numeric,
  quality_status text,
  quality_reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_generated_posts_project on public.generated_posts(project_id);
create index if not exists idx_generated_posts_status on public.generated_posts(status);
create trigger trg_generated_posts_updated_at
  before update on public.generated_posts
  for each row execute function autoscale_set_updated_at();

create table if not exists public.post_slides (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.generated_posts(id) on delete cascade,
  slide_number int not null,
  headline text,
  body text,
  image_url text,
  unique (post_id, slide_number)
);
create index if not exists idx_post_slides_post on public.post_slides(post_id);

-- ---------- Scheduling + Postiz --------------------------------------------

create table if not exists public.postiz_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  api_url text,
  api_key text,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_postiz_connections_updated_at
  before update on public.postiz_connections
  for each row execute function autoscale_set_updated_at();

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  post_id uuid not null references public.generated_posts(id) on delete cascade,
  platform text,
  channel text,
  scheduled_for timestamptz,
  postiz_payload jsonb not null default '{}'::jsonb,
  postiz_response jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_scheduled_posts_project on public.scheduled_posts(project_id);
create index if not exists idx_scheduled_posts_post on public.scheduled_posts(post_id);

-- ---------- Experiments + Winners + Variants + Learnings -------------------

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  post_id uuid references public.generated_posts(id) on delete set null,
  scheduled_post_id uuid references public.scheduled_posts(id) on delete set null,
  status text not null default 'draft',
  posted_at timestamptz,
  views bigint,
  saves bigint,
  shares bigint,
  comments bigint,
  clicks bigint,
  signups bigint,
  purchases bigint,
  revenue numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_experiments_project on public.experiments(project_id);
create trigger trg_experiments_updated_at
  before update on public.experiments
  for each row execute function autoscale_set_updated_at();

create table if not exists public.winners (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  winning_reason text,
  winning_elements jsonb not null default '{}'::jsonb,
  recommended_next_actions jsonb not null default '[]'::jsonb,
  learning_to_store text,
  created_at timestamptz not null default now()
);
create index if not exists idx_winners_project on public.winners(project_id);

create table if not exists public.variants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  winner_id uuid not null references public.winners(id) on delete cascade,
  post_id uuid references public.generated_posts(id) on delete set null,
  hook text,
  angle text,
  format text,
  target_audience text,
  notes text,
  status text not null default 'idea',
  created_at timestamptz not null default now()
);
create index if not exists idx_variants_project on public.variants(project_id);

create table if not exists public.learnings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_winner_id uuid references public.winners(id) on delete set null,
  category text,
  learning text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_learnings_project on public.learnings(project_id);

-- ---------- Assets + AI runs + Prompts + Exports + Brand voice --------------

create table if not exists public.brand_voice (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  tone text,
  vocabulary jsonb not null default '[]'::jsonb,
  avoid jsonb not null default '[]'::jsonb,
  reference_examples jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);
create trigger trg_brand_voice_updated_at
  before update on public.brand_voice
  for each row execute function autoscale_set_updated_at();

create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  storage_path text not null,
  url text,
  mime_type text,
  size_bytes bigint,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_assets_project on public.assets(project_id);

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text not null,
  system text,
  template text,
  schema jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  unique (name, version)
);

create table if not exists public.ai_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  provider text not null,
  model text not null,
  prompt_version text,
  input jsonb not null default '{}'::jsonb,
  input_hash text,
  raw_output text,
  parsed_output jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  validation_error text,
  retry_count int not null default 0,
  latency_ms int,
  cost_estimate numeric,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists idx_ai_runs_owner on public.ai_runs(owner_id);
create index if not exists idx_ai_runs_project on public.ai_runs(project_id);
create index if not exists idx_ai_runs_kind on public.ai_runs(kind);

create table if not exists public.exports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  status text not null default 'ready',
  file_path text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_exports_project on public.exports(project_id);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.product_briefs enable row level security;
alter table public.competitors enable row level security;
alter table public.competitor_accounts enable row level security;
alter table public.trendwatch_runs enable row level security;
alter table public.trendwatch_sources enable row level security;
alter table public.trendwatch_insights enable row level security;
alter table public.hooks enable row level security;
alter table public.content_ideas enable row level security;
alter table public.generated_posts enable row level security;
alter table public.post_slides enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.postiz_connections enable row level security;
alter table public.experiments enable row level security;
alter table public.winners enable row level security;
alter table public.variants enable row level security;
alter table public.learnings enable row level security;
alter table public.assets enable row level security;
alter table public.ai_runs enable row level security;
alter table public.exports enable row level security;
alter table public.brand_voice enable row level security;
alter table public.usage_counters enable row level security;
alter table public.plans enable row level security;
alter table public.prompt_versions enable row level security;

-- Profiles: each user only sees their own row
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles self update" on public.profiles
  for update using (auth.uid() = id);

-- Projects: owner-only
create policy "projects owner all" on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- Helper: a row is accessible if its project belongs to the user
-- Apply identical owner-by-project policy to every child table
do $$
declare
  t text;
  project_owned_tables text[] := array[
    'product_briefs','competitors','competitor_accounts','trendwatch_runs',
    'trendwatch_sources','trendwatch_insights','hooks','content_ideas',
    'generated_posts','scheduled_posts','experiments','winners','variants',
    'learnings','assets','exports','brand_voice'
  ];
begin
  foreach t in array project_owned_tables loop
    execute format($f$
      create policy "%1$s project owner all" on public.%1$s
        for all using (
          exists (select 1 from public.projects p where p.id = %1$s.project_id and p.owner_id = auth.uid())
        )
        with check (
          exists (select 1 from public.projects p where p.id = %1$s.project_id and p.owner_id = auth.uid())
        );
    $f$, t);
  end loop;
end$$;

-- post_slides → through generated_posts → through projects
create policy "post_slides via post" on public.post_slides
  for all using (
    exists (
      select 1 from public.generated_posts gp
      join public.projects p on p.id = gp.project_id
      where gp.id = post_slides.post_id and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.generated_posts gp
      join public.projects p on p.id = gp.project_id
      where gp.id = post_slides.post_id and p.owner_id = auth.uid()
    )
  );

-- postiz_connections: owner-only
create policy "postiz_connections owner all" on public.postiz_connections
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ai_runs: owner-only
create policy "ai_runs owner all" on public.ai_runs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- usage_counters: owner-only
create policy "usage_counters owner all" on public.usage_counters
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- plans: read-only public
create policy "plans select all" on public.plans for select using (true);

-- prompt_versions: read-only for authenticated users
create policy "prompt_versions select auth" on public.prompt_versions
  for select using (auth.role() = 'authenticated');

-- ============================================================================
-- Storage buckets (run from Supabase Studio if not already created)
-- ============================================================================
-- Bucket: project-assets (private)
-- Bucket: project-exports (private)
-- Add policies that allow users to read/write only objects whose first path
-- segment matches their auth.uid(). See docs/DATA_MODEL.md for setup.
