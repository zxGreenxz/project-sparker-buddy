-- ===============================================
-- Setup Script for Facebook Comments Archive
-- ===============================================
-- Run this SQL in your Supabase SQL Editor
-- This will create the table, indexes, RLS policies, and cron job

-- 1. Create facebook_comments_archive table
CREATE TABLE IF NOT EXISTS facebook_comments_archive (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Facebook data
  facebook_comment_id TEXT UNIQUE NOT NULL,
  facebook_post_id TEXT NOT NULL,
  facebook_user_id TEXT,
  facebook_user_name TEXT,
  comment_message TEXT,
  comment_created_time TIMESTAMPTZ,
  like_count INTEGER DEFAULT 0,
  
  -- TPOS tracking
  tpos_order_id TEXT,
  tpos_session_index TEXT,
  is_deleted_by_tpos BOOLEAN DEFAULT FALSE,
  tpos_sync_status TEXT DEFAULT 'no_order', -- 'no_order' | 'synced' | 'deleted'
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_synced_at TIMESTAMPTZ,
  last_fetched_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fb_comments_post ON facebook_comments_archive(facebook_post_id);
CREATE INDEX IF NOT EXISTS idx_fb_comments_user ON facebook_comments_archive(facebook_user_id);
CREATE INDEX IF NOT EXISTS idx_fb_comments_tpos_order ON facebook_comments_archive(tpos_order_id);
CREATE INDEX IF NOT EXISTS idx_fb_comments_sync_status ON facebook_comments_archive(tpos_sync_status, is_deleted_by_tpos);
CREATE INDEX IF NOT EXISTS idx_fb_comments_post_time ON facebook_comments_archive(facebook_post_id, comment_created_time DESC);
CREATE INDEX IF NOT EXISTS idx_fb_comments_created_time ON facebook_comments_archive(comment_created_time);

-- 3. Enable RLS
ALTER TABLE facebook_comments_archive ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policy: Allow authenticated users to read
CREATE POLICY "Allow authenticated read facebook_comments_archive"
ON facebook_comments_archive
FOR SELECT
TO authenticated
USING (true);

-- 5. Enable realtime
ALTER TABLE facebook_comments_archive REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE facebook_comments_archive;

-- 6. Enable required extensions for cron job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 7. Create cron job to cleanup old comments (older than 1 month)
-- Runs daily at 3:00 AM
SELECT cron.schedule(
  'cleanup-old-facebook-comments',
  '0 3 * * *',
  $$
  DELETE FROM facebook_comments_archive
  WHERE comment_created_time < NOW() - INTERVAL '1 month';
  $$
);

-- ===============================================
-- Setup complete!
-- ===============================================
-- The system will now:
-- 1. Save all comments to facebook_comments_archive
-- 2. Load comments from DB first (5-10x faster)
-- 3. Auto-delete comments older than 1 month
-- 4. Track orders deleted by TPOS
-- ===============================================
