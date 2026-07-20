# DKLedger Accounting Engine Production Readiness

Reviewed on July 19, 2026 for branch `fix/accounting-integrity`.

## Section 1: Migration Execution Order

Apply SQL migrations in this exact order in staging first, then production:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_fix_rls_policies.sql`
3. `supabase/migrations/003_team_member_invitations.sql`
4. `supabase/migrations/004_add_organization_active_flag.sql`
5. `supabase/migrations/005_add_voucher_attachments.sql`
6. `supabase/migrations/006_add_payroll_module.sql`
7. `supabase/migrations/007_allow_voucher_delete_policies.sql`
8. `supabase/migrations/008_add_voucher_visibility_fields.sql`
9. `supabase/migrations/009_add_payroll_audit_trail.sql`
10. `supabase/migrations/010_add_payroll_policies.sql`
11. `supabase/migrations/011_add_account_head_hierarchy.sql`
12. `supabase/migrations/012_add_voucher_reversal_metadata.sql`
13. `supabase/migrations/013_add_payment_mode_account_mapping.sql`

Execution notes:
- `006_add_payroll_module.sql` overlaps with the tracked Prisma payroll migration. On an existing Supabase database, prefer the SQL migration path already used by the repo scripts instead of trying to recreate schema from Prisma.
- `012_add_voucher_reversal_metadata.sql` and `013_add_payment_mode_account_mapping.sql` are backward-compatible and must be applied before using reversal or explicit payment-mode FK paths in production.
- After `013_add_payment_mode_account_mapping.sql`, review the migration notice output for any unmapped `payment_modes` rows before opening production traffic.

## Section 2: Required Environment Variables

Required for runtime:
- `NODE_ENV=production`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Required for database migration tooling and emergency SQL access:
- `DATABASE_URL`
- `DIRECT_URL`

Optional but useful for database bootstrap scripts:
- `SUPABASE_DB_PASSWORD`

Rules:
- `NEXT_PUBLIC_SUPABASE_URL` must be a full `https://<project-ref>.supabase.co` URL.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only and must not appear in client bundles.
- Missing public auth config in production fails closed through `proxy.ts`.

## Section 3: Database Backup Plan

Pre-release backup requirements:
- Take a full logical backup of the production database immediately before the release window.
- Confirm restore access for the target environment before beginning migration execution.
- Export the current `payment_modes` and `vouchers` tables separately for quick inspection because Batch 6 and Batch 7 changed those paths.

Minimum backup checklist:
- Full database dump
- Schema-only dump
- Table-level export for:
  - `vouchers`
  - `voucher_entries`
  - `payment_modes`
  - `account_heads`
  - `payroll_runs`
  - `payroll_run_items`
  - `payroll_run_components`

Retention recommendation:
- Keep the pre-release backup until the first successful month-end close on the new release.

## Section 4: Pre-Release Smoke Tests

Run before production cutover:
- `cmd /c npm run test:auth`
- `cmd /c npm run test:hierarchy`
- `cmd /c npm run test:vouchers`
- `cmd /c npm run test:reversal`
- `cmd /c npm run test:payroll`
- `cmd /c npm run test:mapping`
- `cmd /c npm run test:reports`
- `cmd /c npm run test:regression`
- `cmd /c npm run lint`
- `cmd /c npm run typecheck`
- `cmd /c npm run build`

Staging functional checklist:
- Register or log in as an owner/admin user.
- Open a protected route with valid auth config and confirm normal access.
- Create a client and confirm tenant isolation.
- Create a posted voucher and confirm direct edit/delete is blocked.
- Reverse a posted voucher and confirm the original stays unchanged and linked.
- Run trial balance, profit/loss, and balance sheet after reversal and confirm they remain balanced.
- Create a payroll run, post accrual, pay payroll, and confirm salary payable clears.
- Rename a bank account mapped to a payment mode and confirm bank statement generation still works.
- Attempt closed fiscal-year voucher and payroll mutations and confirm rejection.
- Review `payment_modes` after migration 013 and confirm no unresolved critical unmapped rows remain.

## Section 5: Post-Release Verification

Verify immediately after deployment:
- All production migrations completed in order with no partial failure.
- Protected routes fail closed if auth config is broken.
- Login, client selection, and organization membership checks still work.
- Create one low-risk posted voucher in staging or a designated production test tenant.
- Reverse one designated production test voucher and confirm:
  - reversal voucher is posted
  - links are stored
  - original voucher remains immutable
- Generate:
  - ledger
  - trial balance
  - profit/loss
  - balance sheet
  - bank statement
- Post and pay one payroll run in a non-critical tenant if a production dry-run tenant exists.
- Inspect application logs for 401, 403, 404, 409, and 503 spikes.

## Section 6: Rollback Steps

Application rollback:
1. Stop production rollout traffic or pause deployment promotion.
2. Redeploy the last known-good application build.

Database rollback decision:
- If migrations succeeded and application-only behavior regressed, prefer application rollback first.
- If migration `012` or `013` introduced blocking behavior and no production writes depend on the new columns yet, use the rollback guidance embedded in:
  - `supabase/migrations/012_add_voucher_reversal_metadata.sql`
  - `supabase/migrations/013_add_payment_mode_account_mapping.sql`
- If production writes occurred after migration, prefer restoring from the pre-release backup rather than manually dropping columns with live dependent data.

Emergency rollback sequence:
1. Put the app in maintenance mode or restrict user access.
2. Restore the pre-release database backup into the production target.
3. Redeploy the last known-good application build.
4. Re-run smoke tests on auth, voucher posting, payroll posting, and reports.

## Section 7: Remaining Known Risks

- Migration `013_add_payment_mode_account_mapping.sql` may leave legacy `payment_modes` unmapped when names are ambiguous or no active asset account exists. Those rows must be resolved before relying on production payment-mode posting/reporting.
- The integrity suite is strong at logic and integration-harness level, but it is not a full browser-plus-database end-to-end release test.
- Supabase RLS and service-role behavior must be validated in the actual production project, not only locally.
- Release quality still depends on disciplined migration execution order and a verified backup restore path.

## Section 8: Go / No-Go Decision

Current recommendation: `No-Go` until all of the following are complete:
- Staging database has been migrated through `013_add_payment_mode_account_mapping.sql`.
- Any unmapped payment modes reported by migration 013 are resolved.
- Pre-release production backup and restore verification are completed.
- The full smoke-test checklist passes in staging with real auth and database configuration.

Recommendation becomes `Go` once those blockers are cleared and the validation suite remains green on the exact release candidate.

## Release Checklist

- Confirm production env vars are present and non-placeholder.
- Confirm backup completion timestamp and restore owner.
- Apply migrations in order.
- Review migration 013 unmapped rows output.
- Run staging smoke tests on the release candidate.
- Deploy application build.
- Run post-release verification.
- Monitor logs and key accounting actions for at least one business cycle.

## Monitoring And Logging

Monitor these production signals:
- HTTP 401, 403, 404, 409, and 503 rates
- `x-accountpro-auth-config-error` responses
- voucher creation/update/reversal failures
- payroll accrual/payment posting failures
- bank statement generation failures
- migration errors and unmapped payment-mode counts

Log requirements:
- request path
- tenant/client id when available
- voucher id or payroll run id when available
- safe error code/message
- mutation operation type

Do not log:
- service-role keys
- anon keys
- access tokens
- raw database passwords
