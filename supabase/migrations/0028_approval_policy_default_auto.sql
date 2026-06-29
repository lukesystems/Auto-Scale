-- Default new accounts to uninterrupted runs; users opt into pauses via Settings.
alter table public.user_settings
  alter column approval_policy set default 'auto_approve_all';
