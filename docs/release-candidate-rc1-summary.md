# Release Candidate RC1 Summary

Prepared on July 19, 2026 for branch `fix/accounting-integrity`.

## Completed Integrity Batches

- Batch 1: Chart of accounts hierarchy alignment and account integrity safeguards
- Batch 3: Financial report reconciliation for balance sheet and bank statement behavior
- Batch 4: Payroll posting atomicity and lifecycle protections
- Batch 5: Authentication and proxy fail-safe behavior
- Batch 6: Posted voucher reversal workflow with audit-safe metadata
- Batch 7: Explicit payment mode to account mapping via foreign key
- Batch 8: Full accounting integrity regression coverage
- Batch 9: Production release readiness review and release runbook

## Migration List

Apply in order:

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

## Staging Checklist

- Apply migrations through `013_add_payment_mode_account_mapping.sql`
- Review unmapped `payment_modes` rows reported by migration 013 and resolve them
- Verify required env vars are present and non-placeholder
- Run:
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
- Smoke-test:
  - protected auth flow
  - tenant isolation
  - voucher posting and immutability
  - voucher reversal
  - payroll accrual and payment
  - bank statements after payment-mode FK mapping
  - closed fiscal-year mutation rejection

## Production Checklist

- Take and verify a production backup before the release window
- Confirm rollback owner and restore procedure
- Apply migrations in exact order
- Resolve migration 013 unmapped payment-mode rows before opening traffic
- Deploy the RC1 application build
- Execute post-release verification on a low-risk tenant
- Monitor accounting and auth error rates during the first business cycle

## Known Risks

- Legacy payment modes may remain unmapped after migration 013 if names are ambiguous or no valid asset account exists
- Release safety depends on applying migrations in order and validating backup restore access
- Integrity coverage is strong at logic and integration-test level, but not a full live browser-plus-database end-to-end certification

## Release Blockers

- Staging migration and smoke-test completion
- Production backup and restore verification
- Resolution of any unmapped payment-mode rows from migration 013
- Creation of a clean release commit on this branch

## Recommended Release Sequence

1. Commit RC1 on `fix/accounting-integrity`
2. Run the full validation suite on the committed RC1 state
3. Migrate staging through `013`
4. Resolve staging unmapped payment-mode rows
5. Complete staging smoke tests and sign-off
6. Take a fresh production backup
7. Apply production migrations in order
8. Deploy RC1
9. Run post-release verification
10. Monitor closely and hold rollback readiness until stable
