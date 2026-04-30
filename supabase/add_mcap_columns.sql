-- Add to existing trades table if not already present
ALTER TABLE trades
  ADD COLUMN IF NOT EXISTS sol_raised_after  NUMERIC,
  ADD COLUMN IF NOT EXISTS mcap_usd          NUMERIC,
  ADD COLUMN IF NOT EXISTS token_price_usd   NUMERIC;

CREATE INDEX IF NOT EXISTS idx_trades_chart
  ON trades(mint_address, created_at ASC);
