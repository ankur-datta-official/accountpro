CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================
-- 1. ORGANIZATIONS TABLE
-- ============================================
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter','professional','enterprise')),
  max_clients INT DEFAULT 5,
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ORGANIZATION MEMBERS TABLE
-- ============================================
CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'accountant' CHECK (role IN ('owner','admin','accountant','viewer')),
  is_active BOOLEAN DEFAULT TRUE,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(org_id, user_id)
);

-- ============================================
-- 3. CLIENTS TABLE
-- ============================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'company' CHECK (type IN ('company','individual','partnership','ngo')),
  trade_name TEXT,
  bin TEXT,
  tin TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  fiscal_year_start INT DEFAULT 7,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. FISCAL YEARS TABLE
-- ============================================
CREATE TABLE fiscal_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  is_closed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. CHART OF ACCOUNTS (4-level hierarchy)
-- ============================================
CREATE TABLE account_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income','asset','liability')),
  sort_order INT DEFAULT 0
);

CREATE TABLE account_semi_sub_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  group_id UUID REFERENCES account_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE account_sub_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  semi_sub_id UUID REFERENCES account_semi_sub_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT DEFAULT 0
);

CREATE TABLE account_heads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  sub_group_id UUID REFERENCES account_sub_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  opening_balance NUMERIC(15,2) DEFAULT 0,
  balance_type TEXT DEFAULT 'debit' CHECK (balance_type IN ('debit','credit')),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. PAYMENT MODES TABLE
-- ============================================
CREATE TABLE payment_modes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'bank' CHECK (type IN ('bank','cash','mobile_banking','other')),
  account_no TEXT,
  is_active BOOLEAN DEFAULT TRUE
);

-- ============================================
-- 7. VOUCHERS TABLE (Core transaction)
-- ============================================
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
  fiscal_year_id UUID REFERENCES fiscal_years(id),
  voucher_no INT NOT NULL,
  voucher_date DATE NOT NULL,
  voucher_type TEXT NOT NULL CHECK (
    voucher_type IN ('payment','received','journal','contra','bf','bp','br')
  ),
  payment_mode_id UUID REFERENCES payment_modes(id),
  description TEXT,
  month_label TEXT,
  is_posted BOOLEAN DEFAULT TRUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, fiscal_year_id, voucher_no)
);

-- ============================================
-- 8. VOUCHER ENTRIES TABLE (Double-entry lines)
-- ============================================
CREATE TABLE voucher_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES vouchers(id) ON DELETE CASCADE,
  account_head_id UUID REFERENCES account_heads(id),
  accounts_group TEXT,
  debit NUMERIC(15,2) DEFAULT 0,
  credit NUMERIC(15,2) DEFAULT 0,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 9. ROW LEVEL SECURITY (Enable on all tables)
-- ============================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE fiscal_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_semi_sub_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_sub_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_modes ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_entries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM organization_members
  WHERE user_id = auth.uid() AND is_active = TRUE
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE POLICY "members_read_own_org" ON organizations FOR SELECT
USING (id IN (SELECT get_user_org_ids()));

CREATE POLICY "members_read_org_members" ON organization_members FOR SELECT
USING (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "members_read_own_clients" ON clients FOR ALL
USING (org_id IN (SELECT get_user_org_ids()))
WITH CHECK (org_id IN (SELECT get_user_org_ids()));

CREATE POLICY "members_access_fiscal_years" ON fiscal_years FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_account_groups" ON account_groups FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_account_semi_sub_groups" ON account_semi_sub_groups FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_account_sub_groups" ON account_sub_groups FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_account_heads" ON account_heads FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_payment_modes" ON payment_modes FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "client_data_access" ON vouchers FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_voucher_entries" ON voucher_entries FOR ALL
USING (
  voucher_id IN (
    SELECT v.id
    FROM vouchers v
    JOIN clients c ON c.id = v.client_id
    WHERE c.org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  voucher_id IN (
    SELECT v.id
    FROM vouchers v
    JOIN clients c ON c.id = v.client_id
    WHERE c.org_id IN (SELECT get_user_org_ids())
  )
);

-- ============================================
-- 10. INDEXES for performance
-- ============================================
CREATE INDEX idx_vouchers_client_date ON vouchers(client_id, voucher_date);
CREATE INDEX idx_vouchers_client_fy ON vouchers(client_id, fiscal_year_id);
CREATE INDEX idx_voucher_entries_voucher ON voucher_entries(voucher_id);
CREATE INDEX idx_voucher_entries_account ON voucher_entries(account_head_id);
CREATE INDEX idx_account_heads_client ON account_heads(client_id);
