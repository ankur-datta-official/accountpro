CREATE TABLE salary_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES payroll_employees(id) ON DELETE SET NULL,
  fiscal_year_id UUID NOT NULL REFERENCES fiscal_years(id),
  certificate_no TEXT NOT NULL,
  issue_date DATE NOT NULL,
  generated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'cancelled')),
  snapshot_json JSONB NOT NULL
);

ALTER TABLE salary_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_access_salary_certificates" ON salary_certificates FOR ALL
USING (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())))
WITH CHECK (client_id IN (SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())));

CREATE UNIQUE INDEX idx_salary_certificates_client_cert_no
  ON salary_certificates(client_id, certificate_no);

CREATE INDEX idx_salary_certificates_client_fy
  ON salary_certificates(client_id, fiscal_year_id);

CREATE INDEX idx_salary_certificates_client_employee
  ON salary_certificates(client_id, employee_id);

CREATE INDEX idx_salary_certificates_status
  ON salary_certificates(status);
