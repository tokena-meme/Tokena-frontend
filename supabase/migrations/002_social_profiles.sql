/*
  # Social Profile System Migration
  
  ## Tables Created
  1. `profiles` - Extended user profile (display name, bio, links, verified badge, follower counts)
  2. `followers` - Follow relationships between wallets
  3. `token_comments` - Comments on token pages
  4. `comment_likes` - Like tracking per comment
  
  ## Triggers
  - Auto-increment/decrement follower_count and following_count on profiles
  - Auto-increment/decrement likes_count on token_comments
  
  ## Run this in Supabase Dashboard → SQL Editor
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_address TEXT UNIQUE NOT NULL,
  display_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT CHECK (char_length(bio) <= 280),
  twitter TEXT,
  telegram TEXT,
  website TEXT,
  is_verified BOOLEAN DEFAULT false,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_wallet ON profiles(wallet_address);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are publicly readable"
  ON profiles FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert profiles"
  ON profiles FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can update profiles"
  ON profiles FOR UPDATE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- FOLLOWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_wallet TEXT NOT NULL,
  following_wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_wallet, following_wallet)
);

CREATE INDEX IF NOT EXISTS idx_followers_follower ON followers(follower_wallet);
CREATE INDEX IF NOT EXISTS idx_followers_following ON followers(following_wallet);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Followers are publicly readable"
  ON followers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert followers"
  ON followers FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete followers"
  ON followers FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- FOLLOWER COUNT TRIGGERS
-- ============================================================

-- Ensure profiles exist before updating counts
CREATE OR REPLACE FUNCTION ensure_profile_exists(wallet TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO profiles (wallet_address)
  VALUES (wallet)
  ON CONFLICT (wallet_address) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- On follow insert: increment counts
CREATE OR REPLACE FUNCTION on_follow_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM ensure_profile_exists(NEW.follower_wallet);
  PERFORM ensure_profile_exists(NEW.following_wallet);
  
  UPDATE profiles SET follower_count = follower_count + 1, updated_at = NOW()
  WHERE wallet_address = NEW.following_wallet;
  
  UPDATE profiles SET following_count = following_count + 1, updated_at = NOW()
  WHERE wallet_address = NEW.follower_wallet;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_insert
  AFTER INSERT ON followers
  FOR EACH ROW EXECUTE FUNCTION on_follow_insert();

-- On follow delete: decrement counts
CREATE OR REPLACE FUNCTION on_follow_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE profiles SET follower_count = GREATEST(follower_count - 1, 0), updated_at = NOW()
  WHERE wallet_address = OLD.following_wallet;
  
  UPDATE profiles SET following_count = GREATEST(following_count - 1, 0), updated_at = NOW()
  WHERE wallet_address = OLD.follower_wallet;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow_delete
  AFTER DELETE ON followers
  FOR EACH ROW EXECUTE FUNCTION on_follow_delete();

-- ============================================================
-- TOKEN COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS token_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_mint TEXT NOT NULL,
  wallet TEXT NOT NULL,
  text TEXT NOT NULL CHECK (char_length(text) <= 500),
  likes_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_mint ON token_comments(token_mint);
CREATE INDEX IF NOT EXISTS idx_comments_wallet ON token_comments(wallet);
CREATE INDEX IF NOT EXISTS idx_comments_created ON token_comments(created_at DESC);

ALTER TABLE token_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are publicly readable"
  ON token_comments FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert comments"
  ON token_comments FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete comments"
  ON token_comments FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- COMMENT LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS comment_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES token_comments(id) ON DELETE CASCADE,
  wallet TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(comment_id, wallet)
);

CREATE INDEX IF NOT EXISTS idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_wallet ON comment_likes(wallet);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comment likes are publicly readable"
  ON comment_likes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Anyone can insert comment likes"
  ON comment_likes FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete comment likes"
  ON comment_likes FOR DELETE
  TO anon, authenticated
  USING (true);

-- ============================================================
-- COMMENT LIKES COUNT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION on_comment_like_insert()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE token_comments SET likes_count = likes_count + 1
  WHERE id = NEW.comment_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_like_insert
  AFTER INSERT ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION on_comment_like_insert();

CREATE OR REPLACE FUNCTION on_comment_like_delete()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE token_comments SET likes_count = GREATEST(likes_count - 1, 0)
  WHERE id = OLD.comment_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment_like_delete
  AFTER DELETE ON comment_likes
  FOR EACH ROW EXECUTE FUNCTION on_comment_like_delete();

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE token_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE followers;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

ALTER TABLE token_comments REPLICA IDENTITY FULL;
ALTER TABLE followers REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;
