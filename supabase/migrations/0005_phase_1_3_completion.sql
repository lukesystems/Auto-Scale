-- ============================================================================
-- AutoScale Migration 0005 - Phase 1-3 completion
-- ============================================================================

alter table public.trendwatch_sources
  add column if not exists caption text,
  add column if not exists published_at timestamptz;

alter table public.scheduled_posts
  add column if not exists remote_id text,
  add column if not exists release_url text;

create unique index if not exists experiments_scheduled_post_unique
  on public.experiments(scheduled_post_id)
  where scheduled_post_id is not null;

alter table public.trendwatch_sources
  drop constraint if exists trendwatch_sources_confidence_score_check,
  add constraint trendwatch_sources_confidence_score_check
    check (confidence_score >= 0 and confidence_score <= 1),
  drop constraint if exists trendwatch_sources_signal_score_check,
  add constraint trendwatch_sources_signal_score_check
    check (signal_score >= 0 and signal_score <= 1),
  drop constraint if exists trendwatch_sources_metrics_nonnegative_check,
  add constraint trendwatch_sources_metrics_nonnegative_check
    check (
      coalesce(follower_count, 0) >= 0 and coalesce(views, 0) >= 0 and
      coalesce(likes, 0) >= 0 and coalesce(saves, 0) >= 0 and
      coalesce(shares, 0) >= 0 and coalesce(comments, 0) >= 0
    );

create table if not exists public.postiz_channels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  integration_id text not null,
  provider text not null default 'byok',
  platform text not null default 'other',
  name text not null,
  profile text,
  disabled boolean not null default false,
  raw_metadata jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, integration_id)
);
create index if not exists idx_postiz_channels_owner on public.postiz_channels(owner_id);
alter table public.postiz_channels enable row level security;
drop policy if exists "postiz_channels owner all" on public.postiz_channels;
create policy "postiz_channels owner all" on public.postiz_channels
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-assets',
  'project-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "project assets owner select" on storage.objects;
drop policy if exists "project assets owner insert" on storage.objects;
drop policy if exists "project assets owner delete" on storage.objects;
create policy "project assets owner select" on storage.objects
  for select using (
    bucket_id = 'project-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "project assets owner insert" on storage.objects
  for insert with check (
    bucket_id = 'project-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "project assets owner delete" on storage.objects
  for delete using (
    bucket_id = 'project-assets' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Composite SET NULL would also null project_id. RESTRICT preserves the chain.
alter table public.content_ideas
  drop constraint if exists content_ideas_insight_id_project_id_fkey,
  add constraint content_ideas_insight_id_project_id_fkey
    foreign key (insight_id, project_id)
    references public.trendwatch_insights(id, project_id)
    on delete restrict;

alter table public.generated_posts
  drop constraint if exists generated_posts_content_idea_id_project_id_fkey,
  add constraint generated_posts_content_idea_id_project_id_fkey
    foreign key (content_idea_id, project_id)
    references public.content_ideas(id, project_id)
    on delete restrict,
  drop constraint if exists generated_posts_insight_id_project_id_fkey,
  add constraint generated_posts_insight_id_project_id_fkey
    foreign key (insight_id, project_id)
    references public.trendwatch_insights(id, project_id)
    on delete restrict;

alter table public.experiments
  drop constraint if exists experiments_post_id_project_id_fkey,
  add constraint experiments_post_id_project_id_fkey
    foreign key (post_id, project_id)
    references public.generated_posts(id, project_id)
    on delete restrict,
  drop constraint if exists experiments_scheduled_post_id_project_id_fkey,
  add constraint experiments_scheduled_post_id_project_id_fkey
    foreign key (scheduled_post_id, project_id)
    references public.scheduled_posts(id, project_id)
    on delete restrict;

alter table public.learnings
  drop constraint if exists learnings_source_winner_id_project_id_fkey,
  add constraint learnings_source_winner_id_project_id_fkey
    foreign key (source_winner_id, project_id)
    references public.winners(id, project_id)
    on delete restrict;
