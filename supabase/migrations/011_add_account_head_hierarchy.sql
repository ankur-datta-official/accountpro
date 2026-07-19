-- Add parent_id and type columns to account_heads table
ALTER TABLE account_heads 
ADD COLUMN parent_id UUID REFERENCES account_heads(id) ON DELETE CASCADE,
ADD COLUMN type TEXT;

-- Add index for parent_id
CREATE INDEX idx_account_heads_parent ON account_heads(parent_id);
