# AccountPro

AccountPro is a Next.js 14 bookkeeping workspace for managing clients, vouchers, ledgers, trial balance, balance sheet, profit and loss, bank statements, and Excel imports on top of Supabase.

## Stack

- Next.js 14 App Router
- React 18
- Supabase Auth, Postgres, and Storage
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
```

3. Run the development server:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Database migration steps

Run the SQL files in `supabase/migrations` in order:

1. `001_initial_schema.sql`
2. `002_fix_rls_policies.sql`
3. `003_team_member_invitations.sql`
4. `004_add_organization_active_flag.sql`

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
8. Export to Excel
9. Print vouchers and reports
