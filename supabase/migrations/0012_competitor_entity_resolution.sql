-- Phase 5C: competitor entity resolution
--
-- Adds a stable entity_key on competitors (domain:/handle:/name: prefix) so
-- the same competitor is recognized across multiple discovery runs without
-- relying on case-insensitive name matching, and links each source_candidate
-- to the competitor it talks about for a real evidence graph.

alter table public.competitors
  add column if not exists entity_key text;

create index if not exists idx_competitors_entity_key
  on public.competitors(project_id, entity_key)
  where entity_key is not null;

alter table public.source_candidates
  add column if not exists competitor_id uuid
    references public.competitors(id) on delete set null,
  add column if not exists entity_key text;

create index if not exists idx_source_candidates_competitor
  on public.source_candidates(competitor_id)
  where competitor_id is not null;

create index if not exists idx_source_candidates_entity_key
  on public.source_candidates(project_id, entity_key)
  where entity_key is not null;
