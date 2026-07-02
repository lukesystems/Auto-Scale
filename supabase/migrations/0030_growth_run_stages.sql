-- Four-stage gated Growth Run flow

alter table public.growth_runs
  add column if not exists current_stage smallint not null default 1
  check (current_stage between 1 and 4);

comment on column public.growth_runs.current_stage is
  'Macro stage (1=Setup, 2=Strategy, 3=Production, 4=Distribution). Updated at stage boundary pauses.';
