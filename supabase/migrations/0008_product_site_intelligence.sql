-- Phase 1: Product Site Intelligence — evidence tables for crawls, pages, and facts.
-- Phase 2 discovery staging tables included for schema stability.

-- ---------- Product site crawls ---------------------------------------------

create table if not exists public.product_site_crawls (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  source_url text not null,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  primary_adapter text not null default 'crawl4ai',
  fallback_adapters jsonb not null default '[]'::jsonb,
  pages_discovered int not null default 0,
  pages_crawled int not null default 0,
  pages_failed int not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_site_crawls_project
  on public.product_site_crawls(project_id, created_at desc);

-- ---------- Product site pages ------------------------------------------------

create table if not exists public.product_site_pages (
  id uuid primary key default gen_random_uuid(),
  crawl_id uuid not null references public.product_site_crawls(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  final_url text,
  page_type text not null default 'other'
    check (page_type in (
      'home', 'pricing', 'features', 'product', 'about', 'solutions',
      'customers', 'blog', 'docs', 'contact', 'legal', 'other'
    )),
  title text,
  description text,
  markdown text,
  body_text text,
  headings jsonb not null default '[]'::jsonb,
  ctas jsonb not null default '[]'::jsonb,
  adapter_used text not null default 'crawl4ai',
  fetch_status text not null default 'pending'
    check (fetch_status in ('pending', 'success', 'failed')),
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_site_pages_crawl
  on public.product_site_pages(crawl_id);
create index if not exists idx_product_site_pages_project
  on public.product_site_pages(project_id);

-- ---------- Product site facts ------------------------------------------------

create table if not exists public.product_site_facts (
  id uuid primary key default gen_random_uuid(),
  crawl_id uuid not null references public.product_site_crawls(id) on delete cascade,
  page_id uuid references public.product_site_pages(id) on delete set null,
  project_id uuid not null references public.projects(id) on delete cascade,
  fact_type text not null
    check (fact_type in (
      'product_name', 'tagline', 'feature', 'benefit', 'pricing',
      'cta', 'audience', 'pain_point', 'competitor_mention', 'other'
    )),
  fact_key text,
  fact_value text not null,
  confidence text not null default 'medium'
    check (confidence in ('low', 'medium', 'high')),
  evidence_snippet text,
  source_url text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_product_site_facts_crawl
  on public.product_site_facts(crawl_id);
create index if not exists idx_product_site_facts_project
  on public.product_site_facts(project_id, fact_type);

-- ---------- Source discovery runs (Phase 2 staging) ---------------------------

create table if not exists public.source_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'failed')),
  queries jsonb not null default '[]'::jsonb,
  primary_adapter text not null default 'exa',
  fallback_adapters jsonb not null default '[]'::jsonb,
  candidates_found int not null default 0,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_source_discovery_runs_project
  on public.source_discovery_runs(project_id, created_at desc);

-- ---------- Source candidates (Phase 2 staging) ---------------------------------

create table if not exists public.source_candidates (
  id uuid primary key default gen_random_uuid(),
  discovery_run_id uuid not null references public.source_discovery_runs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  url text not null,
  canonical_url text,
  title text,
  snippet text,
  source_type text not null default 'unknown'
    check (source_type in (
      'competitor', 'creator', 'community', 'review', 'comparison',
      'social_post', 'article', 'video', 'unknown'
    )),
  platform text not null default 'other',
  adapter text not null default 'exa',
  discovery_query text,
  discovery_reason text,
  relevance_score numeric not null default 0,
  enrich_status text not null default 'pending'
    check (enrich_status in ('pending', 'enriched', 'failed', 'skipped')),
  review_status text not null default 'pending'
    check (review_status in ('pending', 'accepted', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_source_candidates_run
  on public.source_candidates(discovery_run_id);
create index if not exists idx_source_candidates_project
  on public.source_candidates(project_id, review_status);
create unique index if not exists idx_source_candidates_dedupe
  on public.source_candidates(discovery_run_id, canonical_url)
  where canonical_url is not null;

-- ---------- RLS ---------------------------------------------------------------

alter table public.product_site_crawls enable row level security;
alter table public.product_site_pages enable row level security;
alter table public.product_site_facts enable row level security;
alter table public.source_discovery_runs enable row level security;
alter table public.source_candidates enable row level security;

do $$
declare
  t text;
  project_owned_tables text[] := array[
    'product_site_crawls', 'product_site_pages', 'product_site_facts',
    'source_discovery_runs', 'source_candidates'
  ];
begin
  foreach t in array project_owned_tables loop
    execute format($f$
      create policy "%1$s project owner all" on public.%1$s
        for all using (
          exists (select 1 from public.projects p where p.id = %1$s.project_id and p.owner_id = auth.uid())
        )
        with check (
          exists (select 1 from public.projects p where p.id = %1$s.project_id and p.owner_id = auth.uid())
        );
    $f$, t);
  end loop;
end$$;
