-- Carousel video type + save-rate classifier thresholds (Nadia: 2–3% saves/views).

alter table public.video_concepts
  drop constraint if exists video_concepts_video_type_check;

alter table public.video_concepts
  add constraint video_concepts_video_type_check
  check (video_type in (
    'slide','demo','founder_pov','pain_led','trend_remix','ai_broll','objection','comparison','carousel'
  ));

alter table public.format_fingerprints
  drop constraint if exists format_fingerprints_video_type_check;

alter table public.format_fingerprints
  add constraint format_fingerprints_video_type_check
  check (video_type in (
    'slide','demo','founder_pov','pain_led','trend_remix','ai_broll','objection','comparison','carousel'
  ));

alter table public.project_growth_settings
  add column if not exists promising_save_rate_threshold numeric not null default 0.02
    check (promising_save_rate_threshold between 0 and 1),
  add column if not exists strong_save_rate_threshold numeric not null default 0.03
    check (strong_save_rate_threshold between 0 and 1);
