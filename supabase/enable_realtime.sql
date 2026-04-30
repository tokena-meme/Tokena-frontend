-- 1. Create the publication if it doesn't already physically exist (Supabase default)
BEGIN;
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN 
    CREATE PUBLICATION supabase_realtime; 
  END IF; 
END $$;
COMMIT;

-- 2. Add BOTH tables to the broadcast channel to physically stream updates
ALTER PUBLICATION supabase_realtime ADD TABLE launches;
ALTER PUBLICATION supabase_realtime ADD TABLE trades;

-- 3. Set Replica Identity to FULL if you want UPDATEs/DELETEs fully tracked (optional but good for safety)
ALTER TABLE launches REPLICA IDENTITY FULL;
ALTER TABLE trades REPLICA IDENTITY FULL;
