# DKLedger

DKLedger is a Next.js 14 bookkeeping workspace for managing clients, vouchers, ledgers, trial balance, balance sheet, profit and loss, bank statements, and Excel imports on top of Supabase.

## Stack

- Next.js 14 App Router
- React 18
- Supabase Auth, Postgres, and Storage
- Prisma ORM for server-side Postgres access
- Tailwind CSS + shadcn/ui
- TanStack Query for client-side caching

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with these variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_PASSWORD=your_supabase_database_password
DATABASE_URL=postgresql://postgres:your_password@db.your_project_ref.supabase.co:5432/postgres
DIRECT_URL=postgresql://postgres:your_password@db.your_project_ref.supabase.co:5432/postgres
DKLEDGER_PLATFORM_ADMIN_EMAILS=owner1@dkledger.com,owner2@dkledger.com
```

`NEXT_PUBLIC_SUPABASE_URL` must be the full `https://<project-ref>.supabase.co` URL. If it is missing or malformed, the app now falls back safely instead of crashing the middleware.

3. Run the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Prisma setup

Prisma is configured in `prisma/schema.prisma` against the existing Supabase public schema. The generated client is written to `node_modules/.prisma/client` and exposed through `lib/prisma.ts`.

### One-command database setup (payroll + Prisma)

1. Add your Supabase database password to `.env.local`:

```bash
SUPABASE_DB_PASSWORD=your_database_password
```

2. Run:

```bash
npm run db:setup
```

This will:
- add `DATABASE_URL` and `DIRECT_URL` to `.env.local`
- generate the Prisma client
- apply the payroll migration (`prisma/migrations/20250619000000_add_payroll_module`)

If you already have `DATABASE_URL`, you can run `npm run db:setup` directly without `SUPABASE_DB_PASSWORD`.

Recommended workflow after setup:

```bash
npm run prisma:generate
npm run prisma:migrate:status
```

For Supabase, keep Supabase Auth and Storage calls in the Supabase SDK; use Prisma only from server code for public-schema database reads/writes after checking organization/client permissions in application code.

## Database migration steps

Run the SQL files in `supabase/migrations` in order:

1. `001_initial_schema.sql`
2. `002_fix_rls_policies.sql`
3. `003_team_member_invitations.sql`
4. `004_add_organization_active_flag.sql`
5. `005_add_voucher_attachments.sql`
6. `006_add_payroll_module.sql`
7. `007_allow_voucher_delete_policies.sql`
8. `008_add_voucher_visibility_fields.sql`
9. `009_add_payroll_audit_trail.sql`
10. `010_add_payroll_policies.sql`
11. `011_add_account_head_hierarchy.sql`
12. `012_add_voucher_reversal_metadata.sql`
13. `013_add_payment_mode_account_mapping.sql`
14. `018_add_voucher_entry_payment_mode.sql`
15. `019_add_billing_subscriptions.sql`

Prisma also tracks this migration in `prisma/migrations/20250619000000_add_payroll_module/`. Prefer:

```bash
npm run db:setup
```

That command requires `SUPABASE_DB_PASSWORD` or `DATABASE_URL` in `.env.local`. Alternatively, paste the contents of `006_add_payroll_module.sql` into the Supabase SQL Editor and run it once.

If you are using the Supabase CLI, the usual flow is:

```bash
supabase db push
```

You can also seed sample data with:

```bash
supabase db reset
```

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_PASSWORD` (for `npm run db:setup`)
- `DATABASE_URL`
- `DIRECT_URL`
- `DKLEDGER_PLATFORM_ADMIN_EMAILS`
- `NEXT_PUBLIC_APP_URL`
- `SSLCOMMERZ_STORE_ID`
- `SSLCOMMERZ_STORE_PASSWORD`
- `SSLCOMMERZ_MODE` (`sandbox` or `live`)
- `BILLING_PROFESSIONAL_AMOUNT_BDT`
- `BILLING_SUPPORT_EMAIL` (optional)

## Billing setup

The Bangladesh billing flow now uses hosted SSLCommerz checkout. Package activation happens only after SSLCommerz order validation succeeds.

1. Apply `supabase/migrations/019_add_billing_subscriptions.sql`.
2. Apply `supabase/migrations/020_add_sslcommerz_billing_support.sql`.
3. Set these environment variables:

```bash
NEXT_PUBLIC_APP_URL=https://accountpro-three.vercel.app
SSLCOMMERZ_STORE_ID=your_store_id
SSLCOMMERZ_STORE_PASSWORD=your_store_password
SSLCOMMERZ_MODE=sandbox
BILLING_PROFESSIONAL_AMOUNT_BDT=999
BILLING_SUPPORT_EMAIL=billing@dkledger.com
```

4. In SSLCommerz, configure these callback URLs:
   - Success URL: `https://accountpro-three.vercel.app/api/billing/sslcommerz/success`
   - Fail URL: `https://accountpro-three.vercel.app/api/billing/sslcommerz/fail`
   - Cancel URL: `https://accountpro-three.vercel.app/api/billing/sslcommerz/cancel`
   - IPN URL: `https://accountpro-three.vercel.app/api/billing/sslcommerz/ipn`
5. Open the app settings page as an organization owner or admin and use the Subscription tab to start checkout.

After a successful payment, the app validates the transaction with SSLCommerz, records it in `billing_transactions`, updates `billing_subscriptions`, and unlocks the paid package automatically for the workspace.

## Platform admin access

`DKLEDGER_PLATFORM_ADMIN_EMAILS` controls who can access the top-level DKLedger admin panel at `/`.

1. Add one or more comma-separated DKLedger owner emails to `.env.local`.
2. Register those emails through the normal sign-up form.
3. Only those allowlisted emails will receive the main software admin dashboard and platform-level management view.

All other users are treated as general users:

1. They can create a login account.
2. They do not automatically become DKLedger platform admins.
3. They must be invited or activated into a workspace before they can work inside a client dashboard.

## Organization and client management

- `owner` and `admin` organization members can manage team, settings, and client creation inside their assigned workspace.
- `accountant` and `viewer` members can work inside client-facing areas according to the existing route and API permissions.
- Users without any active membership see an access-pending state after sign-in instead of being granted management access automatically.

If you need to promote an existing user manually inside a workspace, update `organization_members.role` for that user in Supabase.

## Deployment on Vercel

1. Import the repo into Vercel.
2. Add these Vercel project secrets:
   - `supabase_url`
   - `supabase_anon_key`
   - `supabase_service_role_key`
3. Confirm `vercel.json` is present so the build uses `npm run build`.
4. Deploy.

## End-to-end flow

1. Register
2. Create a client
3. Enter opening balances
4. Add vouchers
5. Review ledger
6. Generate trial balance
7. Review balance sheet and profit/loss
8. Manage payroll, import salary sheets, and post accrual/payment vouchers
9. Export to Excel
10. Print vouchers and reports
