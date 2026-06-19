-- Add fields to control visibility of description and supporting documents in voucher print
ALTER TABLE vouchers 
ADD COLUMN show_description BOOLEAN DEFAULT TRUE,
ADD COLUMN show_supporting_documents BOOLEAN DEFAULT TRUE;
