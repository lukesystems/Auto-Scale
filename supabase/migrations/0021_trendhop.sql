-- 0021_trendhop.sql
-- Standalone TrendWatch (trend-hop) module + Growth Run exploration/exploitation
-- batch semantics. This migration adds three new tables for the trend-hop loop
-- and a batch_kind column on growth_runs so the orchestrator can seed concept
-- generation from winners on exploitation batches.

-- ---------------------------------------------------------------------------
-- growth_runs.batch_kind
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_name = 'growth_runs' and column_name = 'batch_kind'
  ) then
    alter table public.growth_runs
      add column batch_kind text not null default 'exploration'
        check (batch_kind in ('exploration', 'exploitation'));
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- trendhop_runs
-- ---------------------------------------------------------------------------
create table if not exists public.trendhop_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','running','success','failed')),
  trigger text not null default 'manual'
    check (trigger in ('manual','scheduled')),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  item_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists trendhop_runs_project_idx
  on public.trendhop_runs(project_id, created_at desc);

alter table public.trendhop_runs enable row level security;

drop policy if exists "trendhop_runs project owner" on public.trendhop_runs;
create policy "trendhop_runs project owner"
  on public.trendhop_runs
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = trendhop_runs.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = trendhop_runs.project_id
        and p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- trendhop_items
-- ---------------------------------------------------------------------------
create table if not exists public.trendhop_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.trendhop_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null,
  trend_name text not null,
  why_hot text,
  "references" jsonb not null default '[]'::jsonb,
  product_angle text,
  suggested_hook text,
  suggested_concept text,
  recency_score numeric,
  confidence numeric,
  dismissed_at timestamptz,
  promoted_video_concept_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists trendhop_items_project_idx
  on public.trendhop_items(project_id, created_at desc);

create index if not exists trendhop_items_run_idx
  on public.trendhop_items(run_id);

alter table public.trendhop_items enable row level security;

drop policy if exists "trendhop_items project owner" on public.trendhop_items;
create policy "trendhop_items project owner"
  on public.trendhop_items
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = trendhop_items.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = trendhop_items.project_id
        and p.owner_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- trendwatch_schedules
-- ---------------------------------------------------------------------------
create table if not exists public.trendwatch_schedules (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  cadence_days integer not null default 7
    check (cadence_days between 1 and 90),
  next_run_at timestamptz,
  enabled boolean not null default true,
  last_run_id uuid references public.trendhop_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id)
);

create index if not exists trendwatch_schedules_due_idx
  on public.trendwatch_schedules(next_run_at)
  where enabled = true;

alter table public.trendwatch_schedules enable row level security;

drop policy if exists "trendwatch_schedules project owner" on public.trendwatch_schedules;
create policy "trendwatch_schedules project owner"
  on public.trendwatch_schedules
  for all
  using (
    exists (
      select 1 from public.projects p
      where p.id = trendwatch_schedules.project_id
        and p.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.projects p
      where p.id = trendwatch_schedules.project_id
        and p.owner_id = auth.uid()
    )
  );
