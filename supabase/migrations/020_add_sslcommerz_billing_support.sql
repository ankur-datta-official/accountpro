alter table public.billing_customers
  drop constraint if exists billing_customers_provider_check;

alter table public.billing_customers
  add constraint billing_customers_provider_check
  check (provider in ('stripe', 'sslcommerz'));

alter table public.billing_subscriptions
  drop constraint if exists billing_subscriptions_provider_check;

alter table public.billing_subscriptions
  add constraint billing_subscriptions_provider_check
  check (provider in ('stripe', 'sslcommerz'));

alter table public.billing_webhook_events
  drop constraint if exists billing_webhook_events_provider_check;

alter table public.billing_webhook_events
  add constraint billing_webhook_events_provider_check
  check (provider in ('stripe', 'sslcommerz'));

create table if not exists public.billing_transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('stripe', 'sslcommerz')),
  tran_id text not null,
  provider_reference_id text,
  plan text not null check (plan in ('starter', 'professional', 'enterprise')),
  amount numeric(12,2) not null,
  currency text not null default 'BDT',
  status text not null,
  session_key text,
  customer_name text,
  customer_email text,
  customer_phone text,
  paid_at timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, tran_id)
);

create index if not exists idx_billing_transactions_org_id on public.billing_transactions (org_id);
create index if not exists idx_billing_transactions_status on public.billing_transactions (status);

alter table public.billing_transactions enable row level security;
alter table public.billing_transactions force row level security;

drop policy if exists "select_own_billing_transactions" on public.billing_transactions;
create policy "select_own_billing_transactions" on public.billing_transactions
for select using (is_org_admin_or_owner(org_id));
