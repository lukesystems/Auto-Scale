-- Phase 4: Signal Scoring — pattern strength + per-source roll-up scores.

alter table public.market_patterns
  add column if not exists strength_score numeric not null default 0,
  add column if not exists transferability_score numeric not null default 0,
  add column if not exists signal_confidence numeric not null default 0,
  add column if not exists score_reasons jsonb not null default '[]'::jsonb;

create index if not exists idx_market_patterns_strength
  on public.market_patterns(project_id, strength_score desc);

create table if not exists public.market_pattern_source_scores (
  id uuid primary key default gen_random_uuid(),
  pattern_id uuid not null references public.market_patterns(id) on delete cascade,
  source_id uuid not null references public.trendwatch_sources(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  relevance numeric,
  format_transferability numeric,
  conversion_intent numeric,
  account_fit numeric,
  signal_score numeric not null default 0,
  confidence_score numeric not null default 0,
  distortion_risk text not null default 'medium'
    check (distortion_risk in ('low', 'medium', 'high')),
  reasons jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (pattern_id, source_id)
);

create index if not exists idx_market_pattern_source_scores_pattern
  on public.market_pattern_source_scores(pattern_id);
create index if not exists idx_market_pattern_source_scores_project
  on public.market_pattern_source_scores(project_id);

alter table public.market_pattern_source_scores enable row level security;

do $$
declare
  t text;
  project_owned_tables text[] := array['market_pattern_source_scores'];
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
