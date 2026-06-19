-- Loop 1 production flow: project exists while the brief is being generated.

alter table public.projects
  add column if not exists product_brief_id uuid;

alter table public.projects
  drop constraint if exists projects_status_check;

alter table public.projects
  add constraint projects_status_check
  check (status in ('brief_generating','brief_failed','brief_saved','active','paused','archived'));

alter table public.projects
  alter column status set default 'brief_generating';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_product_brief_id_fkey'
  ) then
    alter table public.projects
      add constraint projects_product_brief_id_fkey
      foreign key (product_brief_id)
      references public.product_briefs(id)
      on delete set null;
  end if;
end $$;
