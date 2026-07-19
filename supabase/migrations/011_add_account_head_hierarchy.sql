-- Transitional hierarchy support for account_heads.
-- Canonical production model remains:
--   account_groups -> account_semi_sub_groups -> account_sub_groups -> account_heads
--
-- parent_id is kept nullable and optional during transition so existing data and
-- legacy consumers remain valid. Do not drop or backfill legacy hierarchy columns
-- until every consumer has migrated and the data has been verified.
--
-- This migration is written to be idempotent for fresh/manual application.
-- Do not apply it automatically to production without a backup and verification pass.

ALTER TABLE account_heads
ADD COLUMN IF NOT EXISTS parent_id UUID,
ADD COLUMN IF NOT EXISTS type TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'account_heads_parent_id_fkey'
  ) THEN
    ALTER TABLE account_heads
    ADD CONSTRAINT account_heads_parent_id_fkey
    FOREIGN KEY (parent_id)
    REFERENCES account_heads(id)
    ON DELETE RESTRICT
    ON UPDATE NO ACTION;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_account_heads_parent ON account_heads(parent_id);

COMMENT ON COLUMN account_heads.parent_id IS
  'Optional transition-only nested head reference. Legacy sub_group_id classification remains canonical until full hierarchy migration is complete.';

COMMENT ON COLUMN account_heads.type IS
  'Legacy canonical group type copied from account_groups for report compatibility during hierarchy transition.';

-- Recommended manual backfill plan after application code has fully migrated:
-- 1. Keep every existing account_heads.sub_group_id value unchanged.
-- 2. Backfill account_heads.type from the legacy group chain:
--      account_heads -> account_sub_groups -> account_semi_sub_groups -> account_groups
-- 3. Only assign parent_id within the same client_id and sub_group_id.
-- 4. Reject self-parenting, cross-client links, and circular links before writing parent_id.
-- 5. Verify all existing ledger/report consumers still reconcile before any wider rollout.

-- Verification queries to run manually before/after any backfill:
-- A. Heads whose parent belongs to a different client:
--    SELECT child.id, child.client_id, parent.id AS parent_id, parent.client_id AS parent_client_id
--    FROM account_heads child
--    JOIN account_heads parent ON parent.id = child.parent_id
--    WHERE child.client_id IS DISTINCT FROM parent.client_id;
--
-- B. Heads whose parent belongs to a different sub-group:
--    SELECT child.id, child.sub_group_id, parent.id AS parent_id, parent.sub_group_id AS parent_sub_group_id
--    FROM account_heads child
--    JOIN account_heads parent ON parent.id = child.parent_id
--    WHERE child.sub_group_id IS DISTINCT FROM parent.sub_group_id;
--
-- C. Heads that would be orphaned by missing parents:
--    SELECT child.id, child.parent_id
--    FROM account_heads child
--    LEFT JOIN account_heads parent ON parent.id = child.parent_id
--    WHERE child.parent_id IS NOT NULL AND parent.id IS NULL;
--
-- Rollback / recovery notes:
-- - If this migration has been applied but parent_id has not been populated, rollback can
--   stop at removing application usage and leaving the nullable columns in place.
-- - Do not delete account_heads rows to recover from a bad parent assignment.
-- - If parent_id values were populated incorrectly, clear or correct only those values after
--   restoring from backup or using audited manual repair queries.
