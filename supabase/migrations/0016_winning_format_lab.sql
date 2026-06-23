-- Winning Format Lab
-- Converts Growth Runs from unrelated video batches into controlled format
-- experiments with stored evidence, explicit variables, and scale/iterate/kill
-- decisions.

create table if not exists public.format_fingerprints (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  name text not null,
  fingerprint_key text not null,
  video_type text not null check (video_type in (
    'slide','demo','founder_pov','pain_led','trend_remix','ai_broll','objection','comparison'
  )),
  platform text not null check (platform in ('tiktok','instagram','youtube')),
  hook_mechanism text not null,
  visual_grammar text not null,
  script_structure jsonb not null default '[]'::jsonb,
  cta_pattern text not null,
  business_hypothesis text not null,
  transferability_score numeric not null default 0 check (transferability_score between 0 and 1),
  distortion_risk text not null default 'unknown' check (distortion_risk in ('low','medium','high','unknown')),
  confidence numeric not null default 0 check (confidence between 0 and 1),
  missing_evidence jsonb not null default '[]'::jsonb,
  evidence_video_ids jsonb not null default '[]'::jsonb,
  source_pattern_ids jsonb not null default '[]'::jsonb,
  status text not null default 'candidate' check (status in (
    'candidate','testing','winner','iterate','killed'
  )),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (growth_run_id, fingerprint_key)
);
create index if not exists idx_format_fingerprints_project_status
  on public.format_fingerprints(project_id, status);
create trigger trg_format_fingerprints_updated_at
  before update on public.format_fingerprints
  for each row execute function autoscale_set_updated_at();

create table if not exists public.controlled_experiments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  format_fingerprint_id uuid not null references public.format_fingerprints(id) on delete cascade,
  tested_variable text not null check (tested_variable in ('hook','format')),
  audience_pain text not null,
  fixed_body text not null,
  fixed_cta text not null,
  fixed_audience text not null,
  evaluation_window_days integer not null default 3 check (evaluation_window_days between 1 and 30),
  status text not null default 'planned' check (status in (
    'planned','running','evaluating','scale','iterate','kill','complete'
  )),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (growth_run_id, format_fingerprint_id, tested_variable)
);
create index if not exists idx_controlled_experiments_run
  on public.controlled_experiments(growth_run_id);
create trigger trg_controlled_experiments_updated_at
  before update on public.controlled_experiments
  for each row execute function autoscale_set_updated_at();

create table if not exists public.experiment_cells (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  experiment_id uuid not null references public.controlled_experiments(id) on delete cascade,
  concept_id uuid not null unique references public.video_concepts(id) on delete cascade,
  variant_label text not null,
  variable_value text not null,
  hypothesis text not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_experiment_cells_experiment
  on public.experiment_cells(experiment_id);

create table if not exists public.trend_receipts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  growth_run_id uuid not null references public.growth_runs(id) on delete cascade,
  concept_id uuid not null unique references public.video_concepts(id) on delete cascade,
  format_fingerprint_id uuid not null references public.format_fingerprints(id) on delete cascade,
  evidence_video_ids jsonb not null default '[]'::jsonb,
  source_pattern_ids jsonb not null default '[]'::jsonb,
  observed_evidence jsonb not null default '[]'::jsonb,
  strategic_inference jsonb not null default '[]'::jsonb,
  expected_signal text not null,
  reasoning text not null,
  confidence numeric not null default 0 check (confidence between 0 and 1),
  missing_evidence jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_trend_receipts_run
  on public.trend_receipts(growth_run_id);

alter table public.growth_experiment_results
  add column if not exists controlled_experiment_id uuid references public.controlled_experiments(id) on delete set null,
  add column if not exists format_fingerprint_id uuid references public.format_fingerprints(id) on delete set null;

alter table public.winner_variants
  add column if not exists child_growth_run_id uuid references public.growth_runs(id) on delete set null;

alter table public.format_fingerprints enable row level security;
alter table public.controlled_experiments enable row level security;
alter table public.experiment_cells enable row level security;
alter table public.trend_receipts enable row level security;

do $$
declare
  t text;
  tables text[] := array[
    'format_fingerprints','controlled_experiments','experiment_cells','trend_receipts'
  ];
begin
  foreach t in array tables loop
    execute format($f$
      drop policy if exists "%1$s project owner all" on public.%1$I;
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
