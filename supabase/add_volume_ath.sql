-- Add volume and ATH tracking columns to launches table
ALTER TABLE launches
  ADD COLUMN IF NOT EXISTS volume_sol     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ath_mcap_usd   NUMERIC DEFAULT 0;

-- Optional: update existing launches with historic data based on current trades
UPDATE launches l
SET 
  volume_sol = COALESCE((SELECT SUM(sol_amount) FROM trades t WHERE t.launch_id = l.id), 0),
  ath_mcap_usd = COALESCE((SELECT MAX(mcap_usd) FROM trades t WHERE t.launch_id = l.id), 10000)
WHERE volume_sol = 0;

-- Refresh Postgrest cache
NOTIFY pgrst, 'reload schema';
