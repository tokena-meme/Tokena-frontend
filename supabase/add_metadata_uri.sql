-- Add metadata_uri column to launches table securely mapped
ALTER TABLE launches
ADD COLUMN IF NOT EXISTS metadata_uri TEXT;
