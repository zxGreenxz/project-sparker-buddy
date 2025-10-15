-- Setup automatic token refresh every 7 days
-- This extends the existing token management system

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create or replace the cron job for auto token refresh
-- Runs every day at 2:00 AM to check and refresh tokens older than 7 days
SELECT cron.schedule(
  'auto-refresh-tpos-token',
  '0 2 * * *', -- Every day at 2:00 AM
  $$
  SELECT
    net.http_post(
      url:='https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/refresh-tpos-token',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhuZW9vdmptd2h6enBod2x3b2pjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1ODg5MDIyNSwiZXhwIjoyMDc0NDY2MjI1fQ.x_Sv6YfuqRcWR7gYx6zBOnCjkSu-RY9TlVr5sWRJRLQ"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id
  FROM tpos_config
  WHERE is_active = true
    AND token_type = 'tpos'
    AND (last_refreshed_at IS NULL OR last_refreshed_at < NOW() - INTERVAL '7 days')
  LIMIT 1;
  $$
);

-- Verify the cron job was created
SELECT jobid, schedule, command, active
FROM cron.job
WHERE jobname = 'auto-refresh-tpos-token';

-- Check current token status
SELECT 
  token_type,
  is_active,
  last_refreshed_at,
  token_status,
  CASE 
    WHEN last_refreshed_at IS NULL THEN 'Never refreshed'
    WHEN last_refreshed_at < NOW() - INTERVAL '7 days' THEN 'Needs refresh'
    ELSE 'OK'
  END as refresh_status,
  NOW() - last_refreshed_at as time_since_refresh
FROM tpos_config
WHERE is_active = true;
