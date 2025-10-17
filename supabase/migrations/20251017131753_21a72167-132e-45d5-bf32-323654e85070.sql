-- Add missing columns to profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

-- Add moderator to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'moderator';

-- Update the user_roles policies to support new role
-- (Policies already support all roles via app_role enum)

COMMENT ON COLUMN public.profiles.avatar_url IS 'User avatar image URL';
COMMENT ON COLUMN public.profiles.is_active IS 'Whether the user account is active';