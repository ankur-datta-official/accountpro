CREATE TABLE IF NOT EXISTS payroll_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_run_id UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  details TEXT,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payroll_audit_trail ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members_access_payroll_audit_trail" ON payroll_audit_trail;

CREATE POLICY "members_access_payroll_audit_trail" ON payroll_audit_trail FOR ALL
USING (
  payroll_run_id IN (
    SELECT pr.id FROM payroll_runs pr
    JOIN clients c ON c.id = pr.client_id
    JOIN team_members tm ON tm.org_id = c.org_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
)
WITH CHECK (
  payroll_run_id IN (
    SELECT pr.id FROM payroll_runs pr
    JOIN clients c ON c.id = pr.client_id
    JOIN team_members tm ON tm.org_id = c.org_id
    WHERE tm.user_id = auth.uid() AND tm.status = 'active'
  )
);

CREATE INDEX IF NOT EXISTS idx_payroll_audit_trail_run ON payroll_audit_trail(payroll_run_id, created_at DESC);
