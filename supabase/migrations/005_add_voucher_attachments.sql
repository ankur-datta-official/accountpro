-- Optional supporting documents for vouchers.
CREATE TABLE voucher_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL CHECK (file_size >= 0),
  mime_type TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE voucher_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_access_voucher_attachments" ON voucher_attachments FOR ALL
USING (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
  AND voucher_id IN (
    SELECT id FROM vouchers WHERE client_id = voucher_attachments.client_id
  )
)
WITH CHECK (
  client_id IN (
    SELECT id FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
  AND voucher_id IN (
    SELECT id FROM vouchers WHERE client_id = voucher_attachments.client_id
  )
);

CREATE INDEX idx_voucher_attachments_voucher ON voucher_attachments(voucher_id);
CREATE INDEX idx_voucher_attachments_client ON voucher_attachments(client_id);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'voucher-documents',
  'voucher-documents',
  false,
  15728640,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "members_read_voucher_documents" ON storage.objects FOR SELECT
USING (
  bucket_id = 'voucher-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_insert_voucher_documents" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'voucher-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);

CREATE POLICY "members_delete_voucher_documents" ON storage.objects FOR DELETE
USING (
  bucket_id = 'voucher-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM clients WHERE org_id IN (SELECT get_user_org_ids())
  )
);
