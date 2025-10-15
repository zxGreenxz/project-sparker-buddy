-- =====================================================
-- COMPLETE TOKEN MANAGEMENT SETUP
-- =====================================================
-- Run this SQL file in Supabase SQL Editor to enable:
-- 1. Separate TPOS and Facebook token management
-- 2. Auto-refresh mechanism (checks daily at 9:00 AM)
-- 3. Token expiry tracking with 3-day default interval
--
-- ⚠️ IMPORTANT: Run this ONCE in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- PART 1: Database Schema Changes
-- =====================================================

-- Add new columns to tpos_config table
ALTER TABLE public.tpos_config 
ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'tpos' CHECK (token_type IN ('tpos', 'facebook')),
ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS refresh_interval_days INT DEFAULT 3,
ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'active' CHECK (token_status IN ('active', 'warning', 'expired'));

-- Drop the old unique constraint if it exists
DROP INDEX IF EXISTS tpos_config_is_active_key;

-- Create unique index for token_type + is_active
-- This ensures only one token of each type can be active at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_tpos_config_token_type_active 
ON public.tpos_config(token_type, is_active) 
WHERE is_active = true;

COMMENT ON INDEX idx_tpos_config_token_type_active IS 
'Đảm bảo chỉ có 1 active token cho mỗi token_type (tpos hoặc facebook)';

-- Migrate existing data to set token_type = 'tpos' and refresh_interval_days = 3
UPDATE public.tpos_config 
SET token_type = 'tpos', 
    last_refreshed_at = NOW(),
    refresh_interval_days = 3
WHERE token_type IS NULL;

-- Add helpful comments
COMMENT ON COLUMN public.tpos_config.token_type IS 'Type of token: tpos or facebook';
COMMENT ON COLUMN public.tpos_config.last_refreshed_at IS 'Last time the token was manually refreshed';
COMMENT ON COLUMN public.tpos_config.refresh_interval_days IS 'Number of days before token should be refreshed (default: 3 days)';
COMMENT ON COLUMN public.tpos_config.token_status IS 'Current status: active, warning (expiring soon), expired';
COMMENT ON COLUMN public.tpos_config.auto_refresh_enabled IS 'Whether to automatically check token expiry';

-- =====================================================
-- PART 2: Cron Job Setup for Auto Token Expiry Check
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing cron job if it exists
SELECT cron.unschedule('check-token-expiry-daily') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'check-token-expiry-daily'
);

-- Create cron job to check token expiry daily at 9:00 AM
SELECT cron.schedule(
  'check-token-expiry-daily',
  '0 9 * * *', -- Every day at 9:00 AM
  $$
  SELECT net.http_post(
    url:='https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/check-token-expiry',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZW9vdmptd2h6enBod2x3b2pjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4OTAyMjUsImV4cCI6MjA3NDQ2NjIyNX0.3OxCLXl9nunVvrXg325Cfwc5dgmwKnqbj0zqMGh4_4w"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);

-- =====================================================
-- PART 3: Verification Queries
-- =====================================================

-- Verify the schema changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tpos_config' 
ORDER BY ordinal_position;

-- Verify cron job was created
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'check-token-expiry-daily';

-- Check current tokens
SELECT id, token_type, is_active, token_status, last_refreshed_at, refresh_interval_days
FROM public.tpos_config
ORDER BY token_type, created_at DESC;

-- =====================================================
-- SETUP COMPLETE! 
-- =====================================================
-- ✅ Token management columns added
-- ✅ Cron job scheduled for daily token expiry checks
-- ✅ Default refresh interval set to 3 days
-- 
-- Next steps:
-- 1. Go to Settings page in your app
-- 2. Update your TPOS and Facebook bearer tokens
-- 3. Tokens will auto-refresh every 3 days
-- =====================================================
