-- ⚠️ IMPORTANT: Run this SQL in Supabase SQL Editor before using the new token management features
-- This adds the necessary columns for separate TPOS and Facebook token management

-- Add new columns to tpos_config table
ALTER TABLE public.tpos_config 
ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'tpos' CHECK (token_type IN ('tpos', 'facebook')),
ADD COLUMN IF NOT EXISTS last_refreshed_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS refresh_interval_days INT DEFAULT 7,
ADD COLUMN IF NOT EXISTS auto_refresh_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS token_status TEXT DEFAULT 'active' CHECK (token_status IN ('active', 'warning', 'expired'));

-- Drop the old unique constraint if it exists
DROP INDEX IF EXISTS tpos_config_is_active_key;

-- Create unique index for token_type + is_active
CREATE UNIQUE INDEX IF NOT EXISTS idx_tpos_config_token_type_active 
ON public.tpos_config(token_type) 
WHERE is_active = true;

-- Migrate existing data to set token_type = 'tpos'
UPDATE public.tpos_config 
SET token_type = 'tpos', 
    last_refreshed_at = NOW()
WHERE token_type IS NULL;

-- Add helpful comments
COMMENT ON COLUMN public.tpos_config.token_type IS 'Type of token: tpos or facebook';
COMMENT ON COLUMN public.tpos_config.last_refreshed_at IS 'Last time the token was manually refreshed';
COMMENT ON COLUMN public.tpos_config.refresh_interval_days IS 'Number of days before token should be refreshed';
COMMENT ON COLUMN public.tpos_config.token_status IS 'Current status: active, warning (expiring soon), expired';
COMMENT ON COLUMN public.tpos_config.auto_refresh_enabled IS 'Whether to automatically check token expiry';

-- Verify the changes
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'tpos_config' 
ORDER BY ordinal_position;
