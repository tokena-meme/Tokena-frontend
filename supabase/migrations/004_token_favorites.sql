/*
  # Token Favorites Migration (Updated)
  
  ## Tables Created
  1. `favorites` - Tracks which tokens users have starred/favorited
  
  ## Tables Modified
  - Adds `favorites_count` to `launches` table to track popularity
*/

-- ============================================================
-- FAVORITES
-- ============================================================
DROP TABLE IF EXISTS favorites CASCADE;

CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, token_mint)
);

CREATE INDEX idx_favorites_wallet ON favorites(wallet_address);
CREATE INDEX idx_favorites_mint ON favorites(token_mint);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Favorites are publicly readable"
  ON favorites FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert favorites"
  ON favorites FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete favorites"
  ON favorites FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- LAUNCHES EXTENSION (FAVORITE COUNT)
-- ============================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'launches' AND column_name = 'favorites_count') THEN
    ALTER TABLE launches ADD COLUMN favorites_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================
-- FAVORITES COUNT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION on_favorite_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE launches SET favorites_count = favorites_count + 1
  WHERE mint_address = NEW.token_mint;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_favorite_insert ON favorites;
CREATE TRIGGER trigger_favorite_insert
  AFTER INSERT ON favorites
  FOR EACH ROW EXECUTE FUNCTION on_favorite_insert();

CREATE OR REPLACE FUNCTION on_favorite_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE launches SET favorites_count = GREATEST(favorites_count - 1, 0)
  WHERE mint_address = OLD.token_mint;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_favorite_delete ON favorites;
CREATE TRIGGER trigger_favorite_delete
  AFTER DELETE ON favorites
  FOR EACH ROW EXECUTE FUNCTION on_favorite_delete();

-- ============================================================
-- REALTIME
-- ============================================================
-- Check if table is already in publication before adding to avoid error
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND schemaname = 'public' 
    AND tablename = 'favorites'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE favorites;
  END IF;
END $$;

ALTER TABLE favorites REPLICA IDENTITY FULL;
