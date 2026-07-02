-- Queryable SLA telemetry for the Fast Experiment Loop.
-- One row per growth run phase, with queued/started/completed timestamps and
-- duration/retry/provider fields that can be aggregated without parsing JSON.

create table if not exists public.growth_run_sla_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  stage_id smallint check (stage_id between 1 and 4),
  phase text not null,
  status text not null check (status in ('pending', 'running', 'succeeded', 'failed', 'skipped')),
  queued_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  provider_latency_ms integer,
  retry_count integer not null default 0,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (growth_run_id, phase)
);

create index if not exists idx_growth_run_sla_events_run
  on public.growth_run_sla_events(growth_run_id, stage_id, phase);

create index if not exists idx_growth_run_sla_events_project_completed
  on public.growth_run_sla_events(project_id, completed_at desc);

drop trigger if exists trg_growth_run_sla_events_updated_at on public.growth_run_sla_events;
create trigger trg_growth_run_sla_events_updated_at
  before update on public.growth_run_sla_events
  for each row execute function autoscale_set_updated_at();

alter table public.growth_run_sla_events enable row level security;

drop policy if exists "growth_run_sla_events project owner read" on public.growth_run_sla_events;
create policy "growth_run_sla_events project owner read" on public.growth_run_sla_events
  for select using (
    exists (
      select 1 from public.projects p
      where p.id = growth_run_sla_events.project_id
      and p.owner_id = auth.uid()
    )
  );

drop policy if exists "growth_run_sla_events project owner write" on public.growth_run_sla_events;
create policy "growth_run_sla_events project owner write" on public.growth_run_sla_events
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = growth_run_sla_events.project_id
      and p.owner_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.projects p
      where p.id = growth_run_sla_events.project_id
      and p.owner_id = auth.uid()
    )
  );
