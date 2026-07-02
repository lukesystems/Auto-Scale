-- Phase 2 Stage 3: extended production formats, render phases, fal render mode default.

alter table public.project_growth_settings
  drop constraint if exists project_growth_settings_production_format_check;

alter table public.project_growth_settings
  add constraint project_growth_settings_production_format_check
    check (production_format in (
      'pain_led', 'slide', 'ai_broll_short', 'objection', 'comparison', 'demo_short'
    ));

comment on column public.project_growth_settings.production_format is
  'Default video production format: pain_led | slide | ai_broll_short | objection | comparison | demo_short';

-- Per-concept render approval before Stage 3 assembly
alter table public.video_concepts
  add column if not exists render_approved boolean not null default true,
  add column if not exists demo_clip_url text;

comment on column public.video_concepts.render_approved is
  'When false, Stage 3 skips render until user approves concept in Production Command Center.';
comment on column public.video_concepts.demo_clip_url is
  'Optional uploaded screen recording URL for demo_short format.';

-- Extended production job statuses for phased render
alter table public.video_production_jobs
  drop constraint if exists video_production_jobs_status_check;

alter table public.video_production_jobs
  add constraint video_production_jobs_status_check
    check (status in (
      'queued', 'planning', 'generating_assets', 'generating_audio', 'generating_subs',
      'assembling', 'uploading', 'quality_check', 'ready', 'failed', 'partial'
    ));

-- Allow caption_ass asset kind
alter table public.generated_assets
  drop constraint if exists generated_assets_kind_check;

alter table public.generated_assets
  add constraint generated_assets_kind_check
    check (kind in (
      'slide_image', 'fal_clip', 'voiceover', 'subtitle', 'caption_ass', 'music', 'final_mp4', 'thumbnail'
    ));
