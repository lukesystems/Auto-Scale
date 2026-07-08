-- Credit-based billing for Lemon Squeezy integration.
--
-- Model (decided 2026-07-08):
--   - Output-weighted credits: growth_run_start = 2, standard video = 1,
--     premium (fal cinematic) video = 3. Intelligence phases are free with an
--     active subscription.
--   - Plans: launch $49 = 25 credits/mo, growth $149 = 80 credits/mo,
--     operator $399 = 250 credits/mo. Project limits 1 / 3 / 10.
--   - Two buckets: plan credits reset every billing cycle; top-up credits
--     never expire. Spend order: plan bucket first, then top-up.

-- ---------- Lemon Squeezy linkage on profiles -------------------------------

alter table public.profiles
  add column if not exists ls_customer_id text,
  add column if not exists ls_subscription_id text,
  add column if not exists subscription_renews_at timestamptz,
  add column if not exists subscription_ends_at timestamptz;

create index if not exists idx_profiles_ls_subscription
  on public.profiles(ls_subscription_id) where ls_subscription_id is not null;

-- ---------- Plans: align with the live landing tiers ------------------------

insert into public.plans (id, name, price_monthly, limits) values
  ('launch', 'Launch', 49, '{}')
on conflict (id) do nothing;

update public.plans set
  name = 'Launch',
  price_monthly = 49,
  limits = '{"projects":1,"credits_per_month":25}'
where id = 'launch';

update public.plans set
  price_monthly = 149,
  limits = '{"projects":3,"credits_per_month":80}'
where id = 'growth';

update public.plans set
  price_monthly = 399,
  limits = '{"projects":10,"credits_per_month":250}'
where id = 'operator';

-- ---------- Credit ledger (append-only audit trail) --------------------------

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  bucket text not null check (bucket in ('plan', 'topup')),
  reason text not null check (reason in (
    'plan_grant', 'plan_reset', 'topup_purchase',
    'growth_run_start', 'video_render', 'video_render_premium',
    'refund', 'manual_adjustment'
  )),
  ref_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_credit_ledger_owner on public.credit_ledger(owner_id, created_at desc);

alter table public.credit_ledger enable row level security;
drop policy if exists "credit_ledger owner read" on public.credit_ledger;
create policy "credit_ledger owner read" on public.credit_ledger
  for select using (auth.uid() = owner_id);
-- Writes go through the service role only (webhooks + spend function).

-- ---------- Materialized balances (one row per user) -------------------------

create table if not exists public.credit_balances (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  plan_credits integer not null default 0 check (plan_credits >= 0),
  topup_credits integer not null default 0 check (topup_credits >= 0),
  cycle_started_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.credit_balances enable row level security;
drop policy if exists "credit_balances owner read" on public.credit_balances;
create policy "credit_balances owner read" on public.credit_balances
  for select using (auth.uid() = owner_id);

-- ---------- Atomic spend function --------------------------------------------
-- Spends from plan bucket first, then top-up. Returns the new balances, or
-- raises 'insufficient_credits' when the combined balance cannot cover it.

create or replace function public.spend_credits(
  p_owner_id uuid,
  p_amount integer,
  p_reason text,
  p_ref_id text default null
) returns table (plan_credits integer, topup_credits integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan integer;
  v_topup integer;
  v_from_plan integer;
  v_from_topup integer;
begin
  if p_amount <= 0 then
    raise exception 'spend amount must be positive';
  end if;

  select b.plan_credits, b.topup_credits into v_plan, v_topup
  from public.credit_balances b
  where b.owner_id = p_owner_id
  for update;

  if not found then
    raise exception 'insufficient_credits';
  end if;

  if v_plan + v_topup < p_amount then
    raise exception 'insufficient_credits';
  end if;

  v_from_plan := least(v_plan, p_amount);
  v_from_topup := p_amount - v_from_plan;

  update public.credit_balances b set
    plan_credits = b.plan_credits - v_from_plan,
    topup_credits = b.topup_credits - v_from_topup,
    updated_at = now()
  where b.owner_id = p_owner_id;

  if v_from_plan > 0 then
    insert into public.credit_ledger (owner_id, delta, bucket, reason, ref_id)
    values (p_owner_id, -v_from_plan, 'plan', p_reason, p_ref_id);
  end if;
  if v_from_topup > 0 then
    insert into public.credit_ledger (owner_id, delta, bucket, reason, ref_id)
    values (p_owner_id, -v_from_topup, 'topup', p_reason, p_ref_id);
  end if;

  return query
    select b.plan_credits, b.topup_credits
    from public.credit_balances b
    where b.owner_id = p_owner_id;
end;
$$;

revoke all on function public.spend_credits(uuid, integer, text, text) from public;
revoke all on function public.spend_credits(uuid, integer, text, text) from anon, authenticated;
grant execute on function public.spend_credits(uuid, integer, text, text) to service_role;
