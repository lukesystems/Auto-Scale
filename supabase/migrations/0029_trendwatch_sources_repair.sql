-- Repair drift: ensure trendwatch_sources columns referenced by promote/enrich exist.
-- Safe to re-run (IF NOT EXISTS).

alter table public.trendwatch_sources
  add column if not exists caption text,
  add column if not exists published_at timestamptz;

alter table public.trendwatch_sources
  add column if not exists fetch_status text not null default 'pending',
  add column if not exists fetched_text text,
  add column if not exists fetch_metadata jsonb not null default '{}'::jsonb,
  add column if not exists confidence_score numeric not null default 0,
  add column if not exists scoring_reasons jsonb not null default '[]'::jsonb;
