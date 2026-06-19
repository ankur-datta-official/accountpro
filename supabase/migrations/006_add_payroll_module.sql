-- Payroll module: employees, salary structures, payroll runs, components, and account mappings.

CREATE TABLE payroll_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  employee_code TEXT,
  name TEXT NOT NULL,
  designation TEXT,
  grade TEXT,
  phone TEXT,
  email TEXT,
  tin TEXT,
  joining_date DATE,
  leaving_date DATE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, employee_code)
);

CREATE TABLE payroll_salary_structures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES payroll_employees(id) ON DELETE CASCADE,
  basic NUMERIC(15,2) DEFAULT 0,
  housing NUMERIC(15,2) DEFAULT 0,
  medical NUMERIC(15,2) DEFAULT 0,
  conveyance NUMERIC(15,2) DEFAULT 0,
  employer_pf NUMERIC(15,2) DEFAULT 0,
  staff_pf NUMERIC(15,2) DEFAULT 0,
  tax NUMERIC(15,2) DEFAULT 0,
  effective_from DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, employee_id)
);

CREATE TABLE payroll_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  period_label TEXT NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','posted','paid','cancelled')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import')),
  notes TEXT,
  accrual_voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  payment_voucher_id UUID REFERENCES vouchers(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, fiscal_year_id, period_label)
);

CREATE TABLE payroll_run_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE SET NULL,
  employee_name TEXT NOT NULL,
  designation TEXT,
  grade TEXT,
  gross_salary NUMERIC(15,2) DEFAULT 0,
  total_additions NUMERIC(15,2) DEFAULT 0,
  total_deductions NUMERIC(15,2) DEFAULT 0,
  net_payable NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_run_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_item_id UUID NOT NULL REFERENCES payroll_run_items(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('earning','employer_contribution','deduction')),
  amount NUMERIC(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE payroll_account_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  component_code TEXT NOT NULL,
  account_head_id UUID NOT NULL REFERENCES account_heads(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, component_code)
);

ALTER TABLE payroll_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_salary_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_account_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_access_payroll_employees" ON payroll_employees FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())));

CREATE POLICY "members_access_payroll_salary_structures" ON payroll_salary_structures FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())));

CREATE POLICY "members_access_payroll_runs" ON payroll_runs FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())));

CREATE POLICY "members_access_payroll_run_items" ON payroll_run_items FOR ALL
USING (
  payroll_run_id IN (
    SELECT pr.id FROM payroll_runs pr
    JOIN clients c ON c.id = pr.client_id
    WHERE c.org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  payroll_run_id IN (
    SELECT pr.id FROM payroll_runs pr
    JOIN clients c ON c.id = pr.client_id
    WHERE c.org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_payroll_run_components" ON payroll_run_components FOR ALL
USING (
  run_item_id IN (
    SELECT pri.id FROM payroll_run_items pri
    JOIN payroll_runs pr ON pr.id = pri.payroll_run_id
    JOIN clients c ON c.id = pr.client_id
    WHERE c.org_id IN (SELECT get_user_org_ids())
  )
)
WITH CHECK (
  run_item_id IN (
    SELECT pri.id FROM payroll_run_items pri
    JOIN payroll_runs pr ON pr.id = pri.payroll_run_id
    JOIN clients c ON c.id = pr.client_id
    WHERE c.org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_access_payroll_account_mappings" ON payroll_account_mappings FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())));

CREATE INDEX idx_payroll_employees_client_active ON payroll_employees(client_id, is_active);
CREATE INDEX idx_payroll_salary_structures_client ON payroll_salary_structures(client_id);
CREATE INDEX idx_payroll_runs_client_fy ON payroll_runs(client_id, fiscal_year_id);
CREATE INDEX idx_payroll_runs_status ON payroll_runs(status);
CREATE INDEX idx_payroll_run_items_run ON payroll_run_items(payroll_run_id);
CREATE INDEX idx_payroll_run_items_employee ON payroll_run_items(employee_id);
CREATE INDEX idx_payroll_run_components_item ON payroll_run_components(run_item_id);
CREATE INDEX idx_payroll_run_components_code ON payroll_run_components(code);
CREATE INDEX idx_payroll_account_mappings_client ON payroll_account_mappings(client_id);

CREATE OR REPLACE FUNCTION ensure_payroll_account_head(
  target_client_id UUID,
  group_name TEXT,
  group_type TEXT,
  semi_name TEXT,
  sub_name TEXT,
  head_name TEXT,
  balance_side TEXT DEFAULT 'debit'
)
RETURNS UUID AS $$
DECLARE
  v_group_id UUID;
  v_semi_id UUID;
  v_sub_id UUID;
  v_head_id UUID;
BEGIN
  SELECT id INTO v_group_id FROM account_groups
  WHERE client_id = target_client_id AND name = group_name
  LIMIT 1;

  IF v_group_id IS NULL THEN
    INSERT INTO account_groups (client_id, name, type, sort_order)
    VALUES (target_client_id, group_name, group_type, 999)
    RETURNING id INTO v_group_id;
  END IF;

  SELECT id INTO v_semi_id FROM account_semi_sub_groups
  WHERE client_id = target_client_id AND group_id = v_group_id AND name = semi_name
  LIMIT 1;

  IF v_semi_id IS NULL THEN
    INSERT INTO account_semi_sub_groups (client_id, group_id, name, sort_order)
    VALUES (target_client_id, v_group_id, semi_name, 999)
    RETURNING id INTO v_semi_id;
  END IF;

  SELECT id INTO v_sub_id FROM account_sub_groups
  WHERE client_id = target_client_id AND semi_sub_id = v_semi_id AND name = sub_name
  LIMIT 1;

  IF v_sub_id IS NULL THEN
    INSERT INTO account_sub_groups (client_id, semi_sub_id, name, sort_order)
    VALUES (target_client_id, v_semi_id, sub_name, 999)
    RETURNING id INTO v_sub_id;
  END IF;

  SELECT id INTO v_head_id FROM account_heads
  WHERE client_id = target_client_id AND name = head_name
  LIMIT 1;

  IF v_head_id IS NULL THEN
    INSERT INTO account_heads (client_id, sub_group_id, name, opening_balance, balance_type, is_active, sort_order)
    VALUES (target_client_id, v_sub_id, head_name, 0, balance_side, TRUE, 999)
    RETURNING id INTO v_head_id;
  END IF;

  RETURN v_head_id;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  c RECORD;
  head_id UUID;
BEGIN
  FOR c IN SELECT id FROM clients LOOP
    head_id := ensure_payroll_account_head(c.id, 'General & Administrative Expenses', 'expense', 'Salary & Benefits', 'Salary & Benefits', 'Salary & Benefits', 'debit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'salary_expense', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'General & Administrative Expenses', 'expense', 'Salary & Benefits', 'Salary & Benefits', 'Employer PF', 'debit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'employer_pf_expense', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'General & Administrative Expenses', 'expense', 'Salary & Benefits', 'Salary & Benefits', 'Gratuity/GF', 'debit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'gratuity_expense', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'General & Administrative Expenses', 'expense', 'Salary & Benefits', 'Salary & Benefits', 'Bonus/Allowance', 'debit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'bonus_expense', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'Current Liabilities', 'liability', 'Bill Payable', 'Bill Payable', 'Salary Payable', 'credit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'salary_payable', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'Current Liabilities', 'liability', 'Bill Payable', 'Bill Payable', 'Provident Fund Payable', 'credit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'pf_payable', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'Current Liabilities', 'liability', 'Provision for Income Tax', 'Provision for Income Tax', 'Tax Payable', 'credit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'tax_payable', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'Current Assets', 'asset', 'Advance Deposit & Prepayments', 'Advance Deposit & Prepayments', 'Staff Loan/Advance', 'debit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'staff_loan_advance', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;

    head_id := ensure_payroll_account_head(c.id, 'Non Operation Income', 'income', 'Non Operation Income', 'Non Operation Income', 'Loan Interest Income', 'credit');
    INSERT INTO payroll_account_mappings (client_id, component_code, account_head_id)
    VALUES (c.id, 'loan_interest_income', head_id)
    ON CONFLICT (client_id, component_code) DO NOTHING;
  END LOOP;
END $$;

DROP FUNCTION ensure_payroll_account_head(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
