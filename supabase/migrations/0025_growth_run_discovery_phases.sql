-- Growth Run: niche evidence discovery phases before VideoTrend
alter table public.growth_runs drop constraint if exists growth_runs_phase_check;

alter table public.growth_runs add constraint growth_runs_phase_check check (phase in (
  'brief',
  'deep_discovery', 'video_discovery', 'pattern_mining',
  'videotrend', 'strategy', 'loadout', 'concepts',
  'scripts', 'storyboards', 'assets', 'videos', 'captions',
  'approval', 'schedule', 'live', 'compound', 'done'
));
