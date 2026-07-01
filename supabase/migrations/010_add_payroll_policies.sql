-- Payroll policies: global percentage settings for auto-calculation

CREATE TABLE payroll_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  housing_percent NUMERIC(5,2) DEFAULT 0,
  medical_percent NUMERIC(5,2) DEFAULT 0,
  conveyance_percent NUMERIC(5,2) DEFAULT 0,
  employer_pf_percent NUMERIC(5,2) DEFAULT 0,
  staff_pf_percent NUMERIC(5,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

ALTER TABLE payroll_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_access_payroll_policies" ON payroll_policies FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())));

CREATE INDEX idx_payroll_policies_client ON payroll_policies(client_id);
