-- ⚠️ IMPORTANT: Run this SQL AFTER running add_token_management_columns.sql
-- This sets up a daily cron job to check token expiry

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

-- Verify cron job was created
SELECT jobid, jobname, schedule, command 
FROM cron.job 
WHERE jobname = 'check-token-expiry-daily';
