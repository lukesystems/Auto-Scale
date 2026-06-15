-- ============================================================================
-- AutoScale Migration 0003 - Source ingestion & confidence scoring columns
-- ============================================================================

alter table public.trendwatch_sources
  add column if not exists fetch_status text not null default 'pending',
  add column if not exists fetched_text text,
  add column if not exists fetch_metadata jsonb not null default '{}'::jsonb,
  add column if not exists confidence_score numeric not null default 0,
  add column if not exists scoring_reasons jsonb not null default '[]'::jsonb;

alter table public.trendwatch_insights
  add column if not exists confidence_score numeric,
  add column if not exists scoring_reasons jsonb not null default '[]'::jsonb;

comment on column public.trendwatch_sources.fetch_status is 'pending | success | failed | skipped';
comment on column public.trendwatch_sources.fetched_text is 'Safe-fetched text snippet from source URL';
comment on column public.trendwatch_sources.fetch_metadata is 'title, description, error, platform from ingestion';
comment on column public.trendwatch_sources.confidence_score is '0-1 confidence from null-aware signal scoring';
comment on column public.trendwatch_sources.scoring_reasons is 'Human-readable scoring/ingestion reasons';
