-- User-level product crawl mode: LLM extraction (default) or fast heuristic.

alter table public.user_settings
  add column if not exists crawl_mode text not null default 'llm'
    check (crawl_mode in ('llm', 'heuristic'));
