/*
  # Comment Replies Migration
  
  ## Tables Modified
  - `token_comments`: Added `parent_id` to support threaded conversations.
*/

-- ============================================================
-- TOKEN COMMENTS (REPLIES SUPPORT)
-- ============================================================
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'token_comments' AND column_name = 'parent_id') THEN
    ALTER TABLE token_comments ADD COLUMN parent_id UUID REFERENCES token_comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comments_parent ON token_comments(parent_id);

-- Ensure old comments have NULL parent_id (already the default, but just for clarity)
UPDATE token_comments SET parent_id = NULL WHERE parent_id IS NULL;
