-- Remove Postiz integration schema. Post Bridge is now the sole live
-- publishing provider; postiz_connections and postbridge_connections were
-- verified to have 0 rows in production, so no user-data migration is
-- required. growth_runs.distribution_mode had rows stuck on the stale
-- 'postiz' default with no real posts behind them; those move to
-- 'postbridge' below.
--
-- Written to be idempotent and tolerant of schema drift: the live database
-- was verified to NOT have postiz_channels (migration 0005 drift), so the
-- channels section creates the table fresh when there is nothing to rename.

-- ---------- Drop the retired Postiz connection table ------------------------
-- (postbridge_connections already exists and is the live credentials table)

drop table if exists public.postiz_connections cascade;

-- ---------- postiz_channels → postbridge_channels ---------------------------
-- Stores synced remote publishing accounts; still in active use for account
-- sync, just under the wrong provider name. Live DB may not have it at all.

alter table if exists public.postiz_channels rename to postbridge_channels;

create table if not exists public.postbridge_channels (
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

drop index if exists public.idx_postiz_channels_owner;
create index if not exists idx_postbridge_channels_owner on public.postbridge_channels(owner_id);

alter table public.postbridge_channels enable row level security;
drop policy if exists "postiz_channels owner all" on public.postbridge_channels;
drop policy if exists "postbridge_channels owner all" on public.postbridge_channels;
create policy "postbridge_channels owner all" on public.postbridge_channels
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- ---------- Rename Postiz-prefixed columns to Post Bridge equivalents ------
-- rename column has no IF EXISTS; guard each rename so the migration is
-- rerunnable and tolerant of partial prior application.

do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('scheduled_posts',   'postiz_payload',           'postbridge_payload'),
      ('scheduled_posts',   'postiz_response',          'postbridge_response'),
      ('schedule_items',    'postiz_post_id',           'postbridge_post_id'),
      ('schedule_items',    'postiz_payload',           'postbridge_payload'),
      ('schedule_items',    'postiz_response',          'postbridge_response'),
      ('schedule_items',    'postiz_status',            'postbridge_status'),
      ('schedule_items',    'postiz_status_synced_at',  'postbridge_status_synced_at'),
      ('connected_accounts','postiz_account_id',        'postbridge_account_id'),
      ('connected_accounts','postiz_provider_id',       'postbridge_provider_id')
    ) as t(tbl, old_col, new_col)
  loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = r.tbl and column_name = r.old_col
    ) then
      execute format('alter table public.%I rename column %I to %I', r.tbl, r.old_col, r.new_col);
    end if;
  end loop;
end $$;

-- ---------- distribution_mode: constraint swap + data fix -------------------
-- Order matters: the old check constraints only allow ('postiz','export_only'),
-- so they must be dropped BEFORE rows can be updated to 'postbridge'.

alter table public.growth_runs
  drop constraint if exists growth_runs_distribution_mode_check;

alter table public.posting_loadouts
  drop constraint if exists posting_loadouts_distribution_mode_check;

update public.growth_runs
  set distribution_mode = 'postbridge'
  where distribution_mode = 'postiz';

update public.posting_loadouts
  set distribution_mode = 'postbridge'
  where distribution_mode = 'postiz';

alter table public.growth_runs
  alter column distribution_mode set default 'postbridge',
  add constraint growth_runs_distribution_mode_check
    check (distribution_mode in ('postbridge', 'export_only'));

alter table public.posting_loadouts
  alter column distribution_mode set default 'postbridge',
  add constraint posting_loadouts_distribution_mode_check
    check (distribution_mode in ('postbridge', 'export_only'));
