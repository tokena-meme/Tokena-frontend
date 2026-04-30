-- DANGER ZONE: This completely wipes ALL data from your database (tokens, trades, profiles, comments, etc.).
-- Use this strictly for resetting your testing environment.

BEGIN;

-- TRUNCATE deletes all rows extremely fast and resets sequences.
-- CASCADE ensures that anything dependent on these tables is wiped too.
TRUNCATE TABLE 
  trades, 
  launches, 
  users, 
  profiles, 
  followers, 
  token_comments, 
  comment_likes, 
  migrations, 
  notifications, 
  favorites, 
  reports, 
  admin_logs 
CASCADE;

-- Optional: Reset fee_config to default if needed
-- DELETE FROM fee_config;
-- INSERT INTO fee_config DEFAULT VALUES;

COMMIT;
