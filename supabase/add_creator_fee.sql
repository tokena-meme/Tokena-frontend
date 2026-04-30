-- Add creator_fee_percent column to launches table
-- Allows creators to set a custom trading fee from 0% to 5%
-- Default is 0% (no creator fee)

ALTER TABLE launches
ADD COLUMN IF NOT EXISTS creator_fee_percent DECIMAL(3,1) DEFAULT 0;

-- Add a CHECK constraint to ensure the fee is within valid range
ALTER TABLE launches
ADD CONSTRAINT chk_creator_fee_range
CHECK (creator_fee_percent >= 0 AND creator_fee_percent <= 5);
