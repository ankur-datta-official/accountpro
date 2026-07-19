-- Batch 7: explicit payment mode to account head mapping
-- Backward-compatible and idempotent where practical.
-- Do not apply automatically from this change set.

alter table if exists public.payment_modes
  add column if not exists account_head_id uuid;

create index if not exists idx_payment_modes_account_head
  on public.payment_modes (account_head_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'payment_modes_account_head_id_fkey'
  ) then
    alter table public.payment_modes
      add constraint payment_modes_account_head_id_fkey
      foreign key (account_head_id)
      references public.account_heads(id)
      on delete no action
      on update no action;
  end if;
end $$;

with eligible_heads as (
  select
    pm.id as payment_mode_id,
    ah.id as account_head_id,
    count(*) over (partition by pm.id) as match_count
  from public.payment_modes pm
  join public.account_heads ah
    on ah.client_id = pm.client_id
   and coalesce(ah.is_active, true) = true
   and ah.type = 'asset'
   and lower(trim(ah.name)) = lower(trim(pm.name))
  where pm.account_head_id is null
),
applied_updates as (
  update public.payment_modes pm
     set account_head_id = eh.account_head_id
    from eligible_heads eh
   where pm.id = eh.payment_mode_id
     and eh.match_count = 1
     and pm.account_head_id is null
  returning pm.id
)
select count(*) from applied_updates;

do $$
declare
  unmapped_count integer;
  unmapped_ids text;
begin
  select count(*)
    into unmapped_count
  from public.payment_modes pm
  where pm.account_head_id is null;

  select string_agg(pm.id::text || ':' || pm.name, ', ' order by pm.name)
    into unmapped_ids
  from public.payment_modes pm
  where pm.account_head_id is null;

  raise notice 'payment_modes backfill left % unmapped row(s). %',
    unmapped_count,
    coalesce(unmapped_ids, 'All rows mapped.');
end $$;

-- Verification queries:
-- select id, name, account_head_id from public.payment_modes order by name;
-- select pm.id, pm.name
-- from public.payment_modes pm
-- where pm.account_head_id is null
-- order by pm.name;

-- Rollback guidance:
-- alter table public.payment_modes drop constraint if exists payment_modes_account_head_id_fkey;
-- drop index if exists public.idx_payment_modes_account_head;
-- alter table public.payment_modes drop column if exists account_head_id;
