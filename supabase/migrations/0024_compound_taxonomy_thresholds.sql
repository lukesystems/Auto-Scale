-- Compound classifier taxonomy (winner / promising / flat / kill) + per-project thresholds.
-- Queued video concepts from TrendHop can exist before a Growth Run is created.

-- ---------------------------------------------------------------------------
-- growth_experiment_results: marketing-aligned classification
-- ---------------------------------------------------------------------------
alter table public.growth_experiment_results
  drop constraint if exists growth_experiment_results_classification_check;

update public.growth_experiment_results
set classification = case classification
  when 'weak_hook' then 'flat'
  when 'weak_cta' then 'flat'
  when 'wrong_audience' then 'flat'
  when 'message_mismatch' then 'flat'
  when 'loser' then 'kill'
  when 'inconclusive' then 'flat'
  else classification
end
where classification in ('weak_hook', 'weak_cta', 'wrong_audience', 'message_mismatch', 'loser', 'inconclusive');

alter table public.growth_experiment_results
  add constraint growth_experiment_results_classification_check
  check (classification in ('winner', 'promising', 'flat', 'kill'));

-- ---------------------------------------------------------------------------
-- project_growth_settings: classifier thresholds
-- ---------------------------------------------------------------------------
alter table public.project_growth_settings
  add column if not exists winner_signup_threshold integer not null default 3
    check (winner_signup_threshold between 0 and 100),
  add column if not exists weak_completion_threshold numeric not null default 0.35
    check (weak_completion_threshold between 0 and 1),
  add column if not exists weak_click_rate_threshold numeric not null default 0.005
    check (weak_click_rate_threshold between 0 and 1),
  add column if not exists flat_views_threshold integer not null default 500
    check (flat_views_threshold between 0 and 1_000_000);

-- ---------------------------------------------------------------------------
-- video_concepts: queue TrendHop promotions for the next Growth Run
-- ---------------------------------------------------------------------------
alter table public.video_concepts
  alter column growth_run_id drop not null;

alter table public.video_concepts
  add column if not exists trendhop_item_id uuid references public.trendhop_items(id) on delete set null,
  add column if not exists queued_for_next_run boolean not null default false;

create index if not exists idx_video_concepts_queued
  on public.video_concepts(project_id)
  where queued_for_next_run = true and growth_run_id is null;
