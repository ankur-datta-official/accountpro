ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_organizations_is_active
ON organizations(is_active);
