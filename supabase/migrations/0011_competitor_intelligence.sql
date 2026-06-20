-- Deep-discovery competitor promotion: link competitors to discovery runs and
-- store structured strategy profiles from synthesis.

alter table public.competitors
  add column if not exists discovery_run_id uuid
    references public.source_discovery_runs(id) on delete set null,
  add column if not exists kind text not null default 'unknown'
    check (kind in ('direct', 'indirect', 'creator', 'audience_magnet', 'community', 'unknown')),
  add column if not exists confidence text not null default 'low'
    check (confidence in ('low', 'medium', 'high')),
  add column if not exists strategy_profile jsonb not null default '{}'::jsonb,
  add column if not exists evidence_urls jsonb not null default '[]'::jsonb,
  add column if not exists discovered_at timestamptz,
  add column if not exists source text not null default 'manual'
    check (source in ('manual', 'deep_discovery'));

create index if not exists idx_competitors_discovery_run
  on public.competitors(discovery_run_id)
  where discovery_run_id is not null;

create unique index if not exists idx_competitors_project_name
  on public.competitors(project_id, lower(name));

alter table public.competitor_accounts
  add column if not exists discovery_run_id uuid
    references public.source_discovery_runs(id) on delete set null;

create unique index if not exists idx_competitor_accounts_dedupe
  on public.competitor_accounts(project_id, platform, lower(handle));
