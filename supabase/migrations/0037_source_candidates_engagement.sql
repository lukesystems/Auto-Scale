-- Real engagement signal for source_candidates, populated by platform-native adapters
-- (e.g. Apify X actor). NULL for candidates discovered via generic web search.
alter table public.source_candidates
  add column if not exists account_type text,
  add column if not exists engagement jsonb,
  add column if not exists posted_at timestamptz;
