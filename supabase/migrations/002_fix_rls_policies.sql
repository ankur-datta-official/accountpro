-- Fix RLS policies for organization-scoped access.
-- This migration replaces existing policies with explicit SELECT/INSERT/UPDATE rules.

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations',
    'organization_members',
    'clients',
    'fiscal_years',
    'account_groups',
    'account_semi_sub_groups',
    'account_sub_groups',
    'account_heads',
    'payment_modes',
    'vouchers',
    'voucher_entries'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      'members_read_own_clients',
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      'org_members_see_own_clients',
      table_name
    );
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I',
      'members_read_own_org',
      table_name
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "members_read_org_members" ON organization_members;
DROP POLICY IF EXISTS "members_access_fiscal_years" ON fiscal_years;
DROP POLICY IF EXISTS "members_access_account_groups" ON account_groups;
DROP POLICY IF EXISTS "members_access_account_semi_sub_groups" ON account_semi_sub_groups;
DROP POLICY IF EXISTS "members_access_account_sub_groups" ON account_sub_groups;
DROP POLICY IF EXISTS "members_access_account_heads" ON account_heads;
DROP POLICY IF EXISTS "members_access_payment_modes" ON payment_modes;
DROP POLICY IF EXISTS "client_data_access" ON vouchers;
DROP POLICY IF EXISTS "members_access_voucher_entries" ON voucher_entries;

DROP POLICY IF EXISTS "select_own_clients" ON clients;
DROP POLICY IF EXISTS "insert_own_clients" ON clients;
DROP POLICY IF EXISTS "update_own_clients" ON clients;
DROP POLICY IF EXISTS "select_own_org" ON organizations;
DROP POLICY IF EXISTS "update_own_org" ON organizations;
DROP POLICY IF EXISTS "select_own_memberships" ON organization_members;
DROP POLICY IF EXISTS "insert_own_memberships" ON organization_members;

CREATE OR REPLACE FUNCTION is_org_member(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE org_id = target_org_id
      AND user_id = auth.uid()
      AND is_active = TRUE
  );
$$;

CREATE OR REPLACE FUNCTION is_org_admin_or_owner(target_org_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE org_id = target_org_id
      AND user_id = auth.uid()
      AND is_active = TRUE
      AND role IN ('owner', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION can_access_client(target_client_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM clients c
    WHERE c.id = target_client_id
      AND is_org_member(c.org_id)
  );
$$;

CREATE OR REPLACE FUNCTION can_access_voucher(target_voucher_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vouchers v
    JOIN clients c ON c.id = v.client_id
    WHERE v.id = target_voucher_id
      AND is_org_member(c.org_id)
  );
$$;

CREATE POLICY "select_own_org" ON organizations
FOR SELECT USING (is_org_member(id));

CREATE POLICY "update_own_org" ON organizations
FOR UPDATE USING (is_org_admin_or_owner(id))
WITH CHECK (is_org_admin_or_owner(id));

CREATE POLICY "select_own_memberships" ON organization_members
FOR SELECT USING (
  user_id = auth.uid()
  OR is_org_admin_or_owner(org_id)
);

CREATE POLICY "insert_own_memberships" ON organization_members
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  OR is_org_admin_or_owner(org_id)
);

CREATE POLICY "select_own_clients" ON clients
FOR SELECT USING (is_org_member(org_id));

CREATE POLICY "insert_own_clients" ON clients
FOR INSERT WITH CHECK (is_org_member(org_id));

CREATE POLICY "update_own_clients" ON clients
FOR UPDATE USING (is_org_member(org_id))
WITH CHECK (is_org_member(org_id));

CREATE POLICY "select_own_fiscal_years" ON fiscal_years
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_fiscal_years" ON fiscal_years
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_fiscal_years" ON fiscal_years
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_account_groups" ON account_groups
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_account_groups" ON account_groups
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_account_groups" ON account_groups
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_account_semi_sub_groups" ON account_semi_sub_groups
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_account_semi_sub_groups" ON account_semi_sub_groups
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_account_semi_sub_groups" ON account_semi_sub_groups
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_account_sub_groups" ON account_sub_groups
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_account_sub_groups" ON account_sub_groups
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_account_sub_groups" ON account_sub_groups
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_account_heads" ON account_heads
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_account_heads" ON account_heads
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_account_heads" ON account_heads
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_payment_modes" ON payment_modes
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_payment_modes" ON payment_modes
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_payment_modes" ON payment_modes
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_vouchers" ON vouchers
FOR SELECT USING (can_access_client(client_id));

CREATE POLICY "insert_own_vouchers" ON vouchers
FOR INSERT WITH CHECK (can_access_client(client_id));

CREATE POLICY "update_own_vouchers" ON vouchers
FOR UPDATE USING (can_access_client(client_id))
WITH CHECK (can_access_client(client_id));

CREATE POLICY "select_own_voucher_entries" ON voucher_entries
FOR SELECT USING (can_access_voucher(voucher_id));

CREATE POLICY "insert_own_voucher_entries" ON voucher_entries
FOR INSERT WITH CHECK (can_access_voucher(voucher_id));

CREATE POLICY "update_own_voucher_entries" ON voucher_entries
FOR UPDATE USING (can_access_voucher(voucher_id))
WITH CHECK (can_access_voucher(voucher_id));
