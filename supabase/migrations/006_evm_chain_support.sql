-- EVM Chain Support Migration
-- Adds chain discriminator and EVM-specific columns to launches and trades

-- Add chain discriminator to launches
ALTER TABLE launches ADD COLUMN IF NOT EXISTS chain TEXT DEFAULT 'solana' CHECK (chain IN ('solana', 'ethereum', 'bsc', 'base', 'arbitrum', 'sepolia'));
CREATE INDEX IF NOT EXISTS idx_launches_chain ON launches(chain);

-- Add EVM-specific columns to launches
ALTER TABLE launches ADD COLUMN IF NOT EXISTS token_address TEXT; -- EVM contract address (0x...)
ALTER TABLE launches ADD COLUMN IF NOT EXISTS eth_threshold NUMERIC; -- ETH threshold for finalization
ALTER TABLE launches ADD COLUMN IF NOT EXISTS eth_raised NUMERIC DEFAULT 0; -- ETH raised so far
ALTER TABLE launches ADD COLUMN IF NOT EXISTS is_tax_token BOOLEAN DEFAULT false;
ALTER TABLE launches ADD COLUMN IF NOT EXISTS dev_buy_fee_percent NUMERIC DEFAULT 0;
ALTER TABLE launches ADD COLUMN IF NOT EXISTS dev_sell_fee_percent NUMERIC DEFAULT 0;
ALTER TABLE launches ADD COLUMN IF NOT EXISTS marketing_buy_fee_percent NUMERIC DEFAULT 0;
ALTER TABLE launches ADD COLUMN IF NOT EXISTS marketing_sell_fee_percent NUMERIC DEFAULT 0;

-- Add chain + eth_amount to trades
ALTER TABLE trades ADD COLUMN IF NOT EXISTS chain TEXT DEFAULT 'solana';
ALTER TABLE trades ADD COLUMN IF NOT EXISTS eth_amount NUMERIC;
