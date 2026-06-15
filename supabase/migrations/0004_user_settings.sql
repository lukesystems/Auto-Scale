-- ============================================================================
-- AutoScale V1.1 — User settings (provider mode + onboarding)
-- ============================================================================

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  provider_mode text not null default 'managed'
    check (provider_mode in ('managed', 'byok')),
  onboarding_completed boolean not null default false,
  preferred_llm_mode text,
  default_project_id uuid references public.projects(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_user_settings_owner on public.user_settings(owner_id);

create trigger trg_user_settings_updated_at
  before update on public.user_settings
  for each row execute function autoscale_set_updated_at();

alter table public.user_settings enable row level security;

create policy "user_settings_select_own"
  on public.user_settings for select
  using (auth.uid() = owner_id);

create policy "user_settings_insert_own"
  on public.user_settings for insert
  with check (auth.uid() = owner_id);

create policy "user_settings_update_own"
  on public.user_settings for update
  using (auth.uid() = owner_id);

-- Seed user_settings when a profile is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  insert into public.user_settings (owner_id)
  values (new.id)
  on conflict (owner_id) do nothing;

  return new;
end;
$$;
