-- BYOK Post Bridge API keys (Advanced Mode)

create table if not exists public.postbridge_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  api_key text,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_postbridge_connections_updated_at
  before update on public.postbridge_connections
  for each row execute function autoscale_set_updated_at();

alter table public.postbridge_connections enable row level security;

create policy "postbridge_connections owner all" on public.postbridge_connections
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
