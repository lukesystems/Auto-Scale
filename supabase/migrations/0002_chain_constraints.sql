-- ============================================================================
-- AutoScale Migration 0002 - Database level project boundary enforcement
-- Restricts foreign keys so child records MUST belong to the same project_id.
-- ============================================================================

-- 1. trendwatch_insights composite unique key
alter table public.trendwatch_insights 
  add constraint trendwatch_insights_id_project_id_key unique (id, project_id);

-- 2. content_ideas composite unique key and foreign key referencing trendwatch_insights
alter table public.content_ideas
  add constraint content_ideas_id_project_id_key unique (id, project_id);

alter table public.content_ideas
  drop constraint if exists content_ideas_insight_id_fkey,
  add constraint content_ideas_insight_id_project_id_fkey 
    foreign key (insight_id, project_id) 
    references public.trendwatch_insights(id, project_id) 
    on delete set null;

-- 3. generated_posts composite unique key and foreign keys referencing content_ideas/trendwatch_insights
alter table public.generated_posts
  add constraint generated_posts_id_project_id_key unique (id, project_id);

alter table public.generated_posts
  drop constraint if exists generated_posts_content_idea_id_fkey,
  add constraint generated_posts_content_idea_id_project_id_fkey
    foreign key (content_idea_id, project_id)
    references public.content_ideas(id, project_id)
    on delete set null;

alter table public.generated_posts
  drop constraint if exists generated_posts_insight_id_fkey,
  add constraint generated_posts_insight_id_project_id_fkey
    foreign key (insight_id, project_id)
    references public.trendwatch_insights(id, project_id)
    on delete set null;

-- 4. scheduled_posts composite unique key and foreign key referencing generated_posts
alter table public.scheduled_posts
  add constraint scheduled_posts_id_project_id_key unique (id, project_id);

alter table public.scheduled_posts
  drop constraint if exists scheduled_posts_post_id_fkey,
  add constraint scheduled_posts_post_id_project_id_fkey
    foreign key (post_id, project_id)
    references public.generated_posts(id, project_id)
    on delete cascade;

-- 5. experiments foreign keys referencing generated_posts/scheduled_posts
alter table public.experiments
  add constraint experiments_id_project_id_key unique (id, project_id);

alter table public.experiments
  drop constraint if exists experiments_post_id_fkey,
  add constraint experiments_post_id_project_id_fkey
    foreign key (post_id, project_id)
    references public.generated_posts(id, project_id)
    on delete set null;

alter table public.experiments
  drop constraint if exists experiments_scheduled_post_id_fkey,
  add constraint experiments_scheduled_post_id_project_id_fkey
    foreign key (scheduled_post_id, project_id)
    references public.scheduled_posts(id, project_id)
    on delete set null;

-- 6. winners composite unique key and foreign key referencing experiments
alter table public.winners
  add constraint winners_id_project_id_key unique (id, project_id);

alter table public.winners
  drop constraint if exists winners_experiment_id_fkey,
  add constraint winners_experiment_id_project_id_fkey
    foreign key (experiment_id, project_id)
    references public.experiments(id, project_id)
    on delete cascade;

-- 7. variants foreign key referencing winners
alter table public.variants
  drop constraint if exists variants_winner_id_fkey,
  add constraint variants_winner_id_project_id_fkey
    foreign key (winner_id, project_id)
    references public.winners(id, project_id)
    on delete cascade;

-- 8. learnings foreign key referencing winners
alter table public.learnings
  drop constraint if exists learnings_source_winner_id_fkey,
  add constraint learnings_source_winner_id_project_id_fkey
    foreign key (source_winner_id, project_id)
    references public.winners(id, project_id)
    on delete set null;
