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

## Add the first admin user

1. Open the registration page and create the first account.
2. The registration flow creates the organization and inserts the first membership automatically.
3. That first membership becomes the organization owner/admin path used for client creation, settings, and team management.

If you need to promote an existing user manually, update `organization_members.role` for that user in Supabase.

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
