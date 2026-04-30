/*
  This script updates the Row-Level Security (RLS) policies for Tokena.
  Because users connect via Solana wallets (and not Supabase Auth), 
  all requests from the DApp utilize the 'anon' role without a JWT auth.uid.
  
  Please copy and paste this script into your Supabase Dashboard -> SQL Editor
  and click "Run" to apply the fixes.
*/

-- 1. USERS
DROP POLICY IF EXISTS "Users can insert own profile" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can insert own profile" 
  ON users FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Users can update own profile" 
  ON users FOR UPDATE 
  TO anon, authenticated 
  USING (true);

-- 2. TRADES
DROP POLICY IF EXISTS "Authenticated users can insert trades" ON trades;

CREATE POLICY "Anyone can insert trades" 
  ON trades FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- 3. MIGRATIONS
DROP POLICY IF EXISTS "Authenticated users can insert migrations" ON migrations;

CREATE POLICY "Anyone can insert migrations" 
  ON migrations FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

-- 4. NOTIFICATIONS
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Anyone can view notifications" 
  ON notifications FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Anyone can insert notifications" 
  ON notifications FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Anyone can update notifications" 
  ON notifications FOR UPDATE 
  TO anon, authenticated 
  USING (true);

-- 5. FAVORITES
DROP POLICY IF EXISTS "Users can view own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can insert own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can delete own favorites" ON favorites;

CREATE POLICY "Anyone can view favorites" 
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

-- 6. REPORTS
DROP POLICY IF EXISTS "Authenticated users can insert reports" ON reports;
DROP POLICY IF EXISTS "Reports readable by authenticated" ON reports;

CREATE POLICY "Anyone can insert reports" 
  ON reports FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

CREATE POLICY "Reports readable by anyone" 
  ON reports FOR SELECT 
  TO anon, authenticated 
  USING (true);

-- 7. ADMIN LOGS
DROP POLICY IF EXISTS "Admin logs readable by authenticated" ON admin_logs;
DROP POLICY IF EXISTS "Authenticated can insert admin logs" ON admin_logs;

CREATE POLICY "Admin logs readable by anyone" 
  ON admin_logs FOR SELECT 
  TO anon, authenticated 
  USING (true);

CREATE POLICY "Anyone can insert admin logs" 
  ON admin_logs FOR INSERT 
  TO anon, authenticated 
  WITH CHECK (true);

