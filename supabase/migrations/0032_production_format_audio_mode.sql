-- Phase 1 Stage 3: user-selectable production format and audio mode.

alter table public.project_growth_settings
  add column if not exists production_format text not null default 'slide'
    check (production_format in ('pain_led', 'slide', 'ai_broll_short')),
  add column if not exists audio_mode text not null default 'voiceover'
    check (audio_mode in ('music_only', 'voiceover', 'voiceover_bgm'));

comment on column public.project_growth_settings.production_format is
  'Default video production format: pain_led | slide | ai_broll_short';
comment on column public.project_growth_settings.audio_mode is
  'Default audio mode: music_only | voiceover | voiceover_bgm';
