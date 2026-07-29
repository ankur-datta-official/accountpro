alter table if exists public.voucher_entries
  add column if not exists payment_mode_id uuid references public.payment_modes(id);

create index if not exists idx_voucher_entries_payment_mode
  on public.voucher_entries (payment_mode_id);

update public.voucher_entries as ve
set payment_mode_id = v.payment_mode_id
from public.vouchers as v
where v.id = ve.voucher_id
  and ve.payment_mode_id is null
  and v.payment_mode_id is not null;
