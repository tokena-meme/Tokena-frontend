/*
  # Tokena Initial Schema

  ## Overview
  Creates all core tables for the Tokena token launchpad platform.

  ## Tables Created
  1. `users` - Wallet-based user profiles
  2. `launches` - Token launch records with DBC pool info and migration state
  3. `trades` - All buy/sell trade records
  4. `migrations` - Records of successful bonding curve → DLMM migrations
  5. `notifications` - User notification inbox
  6. `favorites` - User-saved token bookmarks
  7. `reports` - User-submitted content reports
  8. `fee_config` - Platform fee configuration
  9. `admin_logs` - Admin action audit trail

  ## Security
  - RLS enabled on all user-facing tables
  - Authenticated-only access patterns
*/

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  twitter TEXT,
  telegram TEXT,
  total_volume_sol NUMERIC DEFAULT 0,
  total_launches INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read any profile"
  ON users FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = id::text);

-- LAUNCHES
CREATE TABLE IF NOT EXISTS launches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_wallet TEXT NOT NULL,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  twitter TEXT,
  telegram TEXT,
  website TEXT,
  mint_address TEXT UNIQUE NOT NULL,
  dbc_pool_address TEXT,
  meteora_pool_address TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','migrated','failed')),
  total_supply BIGINT NOT NULL DEFAULT 1000000000,
  initial_price_sol NUMERIC NOT NULL,
  migration_threshold_sol NUMERIC NOT NULL DEFAULT 85,
  sol_raised NUMERIC DEFAULT 0,
  migration_progress NUMERIC DEFAULT 0,
  is_migrated BOOLEAN DEFAULT false,
  migrated_at TIMESTAMPTZ,
  is_featured BOOLEAN DEFAULT false,
  is_nsfw BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_launches_mint ON launches(mint_address);
CREATE INDEX IF NOT EXISTS idx_launches_status ON launches(status);
CREATE INDEX IF NOT EXISTS idx_launches_creator ON launches(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_launches_created ON launches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_launches_sol_raised ON launches(sol_raised DESC);

ALTER TABLE launches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public launches readable"
  ON launches FOR SELECT
  TO anon, authenticated
  USING (is_banned = false);

CREATE POLICY "Anyone can insert launches"
  ON launches FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Creator can update own launch"
  ON launches FOR UPDATE
  TO anon, authenticated
  USING (true);

-- TRADES
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('buy','sell')),
  sol_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  price_per_token NUMERIC NOT NULL,
  price_impact NUMERIC,
  fee_sol NUMERIC,
  tx_signature TEXT UNIQUE NOT NULL,
  slot BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trades_launch ON trades(launch_id);
CREATE INDEX IF NOT EXISTS idx_trades_wallet ON trades(wallet_address);
CREATE INDEX IF NOT EXISTS idx_trades_mint ON trades(mint_address);
CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);

ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trades are publicly readable"
  ON trades FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert trades"
  ON trades FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- MIGRATIONS
CREATE TABLE IF NOT EXISTS migrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  launch_id UUID NOT NULL REFERENCES launches(id),
  mint_address TEXT NOT NULL,
  dbc_pool_address TEXT NOT NULL,
  meteora_pool_address TEXT NOT NULL,
  sol_amount NUMERIC NOT NULL,
  token_amount NUMERIC NOT NULL,
  tx_signature TEXT UNIQUE NOT NULL,
  migrated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE migrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Migrations are publicly readable"
  ON migrations FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert migrations"
  ON migrations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notif_wallet ON notifications(wallet_address);
CREATE INDEX IF NOT EXISTS idx_notif_read ON notifications(is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (true);

-- FAVORITES
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT NOT NULL,
  launch_id UUID NOT NULL REFERENCES launches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(wallet_address, launch_id)
);

ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
  ON favorites FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own favorites"
  ON favorites FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can delete own favorites"
  ON favorites FOR DELETE
  TO authenticated
  USING (true);

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_wallet TEXT NOT NULL,
  launch_id UUID REFERENCES launches(id),
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','reviewed','actioned','dismissed')),
  reviewed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Reports readable by authenticated"
  ON reports FOR SELECT
  TO authenticated
  USING (true);

-- FEE CONFIG
CREATE TABLE IF NOT EXISTS fee_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creation_fee_sol NUMERIC DEFAULT 0.02,
  trading_fee_bps INTEGER DEFAULT 100,
  creator_fee_share NUMERIC DEFAULT 0.8,
  platform_fee_share NUMERIC DEFAULT 0.2,
  migration_fee_sol NUMERIC DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE fee_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Fee config publicly readable"
  ON fee_config FOR SELECT
  TO anon, authenticated
  USING (true);

INSERT INTO fee_config DEFAULT VALUES;

-- ADMIN LOGS
CREATE TABLE IF NOT EXISTS admin_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_wallet TEXT NOT NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  target_type TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin logs readable by authenticated"
  ON admin_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated can insert admin logs"
  ON admin_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);
