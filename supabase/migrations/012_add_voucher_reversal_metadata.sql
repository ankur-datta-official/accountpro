-- Batch 6: Voucher reversal metadata
-- Backward-compatible only. Do not apply automatically from this change set.

alter table if exists public.vouchers
  add column if not exists is_reversal boolean not null default false,
  add column if not exists reversal_reason text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by text,
  add column if not exists reversed_voucher_id uuid,
  add column if not exists reversal_voucher_id uuid;

create index if not exists idx_vouchers_client_is_reversal
  on public.vouchers (client_id, is_reversal);

create index if not exists idx_vouchers_reversed_voucher_id
  on public.vouchers (reversed_voucher_id);

create index if not exists idx_vouchers_reversal_voucher_id
  on public.vouchers (reversal_voucher_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'vouchers_reversed_voucher_id_fkey'
  ) then
    alter table public.vouchers
      add constraint vouchers_reversed_voucher_id_fkey
      foreign key (reversed_voucher_id)
      references public.vouchers(id)
      on delete no action
      on update no action;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'vouchers_reversal_voucher_id_fkey'
  ) then
    alter table public.vouchers
      add constraint vouchers_reversal_voucher_id_fkey
      foreign key (reversal_voucher_id)
      references public.vouchers(id)
      on delete no action
      on update no action;
  end if;
end $$;

-- Verification queries:
-- select column_name from information_schema.columns where table_schema = 'public' and table_name = 'vouchers'
--   and column_name in ('is_reversal', 'reversal_reason', 'reversed_at', 'reversed_by', 'reversed_voucher_id', 'reversal_voucher_id');
-- select conname from pg_constraint where conname in ('vouchers_reversed_voucher_id_fkey', 'vouchers_reversal_voucher_id_fkey');
-- select indexname from pg_indexes where schemaname = 'public' and tablename = 'vouchers'
--   and indexname in ('idx_vouchers_client_is_reversal', 'idx_vouchers_reversed_voucher_id', 'idx_vouchers_reversal_voucher_id');

-- Rollback guidance:
-- alter table public.vouchers drop constraint if exists vouchers_reversed_voucher_id_fkey;
-- alter table public.vouchers drop constraint if exists vouchers_reversal_voucher_id_fkey;
-- drop index if exists public.idx_vouchers_client_is_reversal;
-- drop index if exists public.idx_vouchers_reversed_voucher_id;
-- drop index if exists public.idx_vouchers_reversal_voucher_id;
-- alter table public.vouchers
--   drop column if exists reversal_voucher_id,
--   drop column if exists reversed_voucher_id,
--   drop column if exists reversed_by,
--   drop column if exists reversed_at,
--   drop column if exists reversal_reason,
--   drop column if exists is_reversal;
