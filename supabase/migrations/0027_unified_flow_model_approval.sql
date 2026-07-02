-- Unified AutoScale flow: per-project model, global approval policy, resumable runs

-- Per-project AI model selection
alter table public.projects
  add column if not exists ai_model_slug text,
  add column if not exists ai_model_source text check (ai_model_source is null or ai_model_source in ('curated', 'advanced'));

-- Global user approval policy for stage gates
alter table public.user_settings
  add column if not exists approval_policy text not null default 'ask_at_critical'
  check (approval_policy in ('auto_approve_all', 'ask_at_critical', 'ask_at_every_stage'));

-- Resumable run: pause for user input between phases
alter table public.growth_runs
  add column if not exists paused_at_phase text;

alter table public.growth_runs drop constraint if exists growth_runs_status_check;
alter table public.growth_runs add constraint growth_runs_status_check check (status in (
  'pending', 'running', 'awaiting_user_input', 'awaiting_approval',
  'scheduled', 'live', 'completed', 'failed', 'cancelled'
));

alter table public.growth_runs drop constraint if exists growth_runs_phase_check;
alter table public.growth_runs add constraint growth_runs_phase_check check (phase in (
  'brief', 'autobrief',
  'deep_discovery', 'video_discovery', 'pattern_mining', 'trendhop',
  'videotrend', 'strategy', 'loadout', 'concepts',
  'scripts', 'storyboards', 'assets', 'videos', 'captions',
  'approval', 'schedule', 'live', 'compound', 'done'
));
