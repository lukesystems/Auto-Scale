-- Independent macro-stage execution for repeat Growth Runs

alter table public.growth_runs
  add column if not exists execution_mode text not null default 'sequential_first'
  check (execution_mode in ('sequential_first', 'stage_only'));

alter table public.growth_runs
  add column if not exists target_stage smallint null
  check (target_stage is null or target_stage between 1 and 4);

comment on column public.growth_runs.execution_mode is
  'sequential_first = gated first-run flow; stage_only = run a single macro stage independently.';

comment on column public.growth_runs.target_stage is
  'When execution_mode=stage_only, the macro stage (1-4) being executed.';
