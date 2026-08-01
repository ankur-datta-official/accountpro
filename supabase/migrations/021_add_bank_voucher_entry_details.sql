alter table if exists public.voucher_entries
  add column if not exists bank_branch_name text,
  add column if not exists bank_instrument_date date,
  add column if not exists bank_check_challan_no text;
