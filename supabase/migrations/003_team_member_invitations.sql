ALTER TABLE organization_members
ADD COLUMN IF NOT EXISTS invited_email TEXT,
ADD COLUMN IF NOT EXISTS invitation_message TEXT;

CREATE INDEX IF NOT EXISTS idx_organization_members_org_id_active
ON organization_members(org_id, is_active);

CREATE INDEX IF NOT EXISTS idx_organization_members_invited_email
ON organization_members(invited_email);
