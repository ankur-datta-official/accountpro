create table if not exists public.billing_customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('stripe')),
  provider_customer_id text not null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, provider),
  unique (provider, provider_customer_id)
);

create table if not exists public.billing_subscriptions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null check (provider in ('stripe')),
  provider_customer_id text,
  provider_subscription_id text not null,
  provider_price_id text,
  plan text not null check (plan in ('starter','professional','enterprise')),
  status text not null,
  currency text,
  amount_minor integer,
  interval text,
  cancel_at_period_end boolean not null default false,
  current_period_start timestamptz,
  current_period_end timestamptz,
  started_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, provider_subscription_id),
  unique (org_id, provider)
);

create table if not exists public.billing_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('stripe')),
  provider_event_id text not null,
  event_type text not null,
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  unique (provider, provider_event_id)
);

create index if not exists idx_billing_customers_org_id on public.billing_customers (org_id);
create index if not exists idx_billing_subscriptions_org_id on public.billing_subscriptions (org_id);
create index if not exists idx_billing_subscriptions_status on public.billing_subscriptions (status);
create index if not exists idx_billing_webhook_events_provider on public.billing_webhook_events (provider, processed_at desc);

alter table public.billing_customers enable row level security;
alter table public.billing_subscriptions enable row level security;
alter table public.billing_webhook_events enable row level security;

alter table public.billing_customers force row level security;
alter table public.billing_subscriptions force row level security;
alter table public.billing_webhook_events force row level security;

drop policy if exists "select_own_billing_customers" on public.billing_customers;
create policy "select_own_billing_customers" on public.billing_customers
for select using (is_org_admin_or_owner(org_id));

drop policy if exists "select_own_billing_subscriptions" on public.billing_subscriptions;
create policy "select_own_billing_subscriptions" on public.billing_subscriptions
for select using (is_org_admin_or_owner(org_id));
