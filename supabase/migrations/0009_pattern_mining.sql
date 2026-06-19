-- Phase 3: Pattern Mining — source-backed market patterns from accepted TrendWatch sources.

create table if not exists public.market_pattern_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  source_count int not null default 0,
  pattern_count int not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_pattern_runs_project
  on public.market_pattern_runs(project_id, created_at desc);

create table if not exists public.market_patterns (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.market_pattern_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  pattern_type text not null
    check (pattern_type in (
      'hook', 'pain', 'angle', 'format', 'cta', 'visual', 'offer', 'positioning'
    )),
  label text not null,
  summary text not null,
  why_it_matters text,
  how_to_use text,
  support_count int not null default 0,
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  source_ids jsonb not null default '[]'::jsonb,
  examples jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_patterns_run
  on public.market_patterns(run_id);
create index if not exists idx_market_patterns_project
  on public.market_patterns(project_id, pattern_type);

create table if not exists public.market_pattern_evidence (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.market_patterns(id) on delete cascade,
  source_id uuid not null references public.trendwatch_sources(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  source_url text,
  evidence_field text not null,
  evidence_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_market_pattern_evidence_pattern
  on public.market_pattern_evidence(pattern_id);
create index if not exists idx_market_pattern_evidence_project
  on public.market_pattern_evidence(project_id);

alter table public.market_pattern_runs enable row level security;
alter table public.market_patterns enable row level security;
alter table public.market_pattern_evidence enable row level security;

do $$
declare
  t text;
  project_owned_tables text[] := array[
    'market_pattern_runs', 'market_patterns', 'market_pattern_evidence'
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
