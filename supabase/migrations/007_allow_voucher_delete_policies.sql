-- Allow members to fully replace vouchers and voucher entries during edits.
-- Without DELETE policies, RLS can leave old voucher_entries in place and the
-- edit flow inserts the latest lines beside the old lines.

DROP POLICY IF EXISTS "delete_own_voucher_entries" ON voucher_entries;
DROP POLICY IF EXISTS "delete_own_vouchers" ON vouchers;

CREATE POLICY "delete_own_voucher_entries" ON voucher_entries
FOR DELETE USING (can_access_voucher(voucher_id));

CREATE POLICY "delete_own_vouchers" ON vouchers
FOR DELETE USING (can_access_client(client_id));
