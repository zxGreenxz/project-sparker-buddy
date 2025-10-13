-- Migration: Drop pending_live_orders table
-- Reason: Redundant table. Using facebook_pending_orders + live_orders to track processing
-- Run this migration in Supabase SQL Editor after deploying the updated code

-- Drop table cascade (removes all constraints and indexes)
DROP TABLE IF EXISTS public.pending_live_orders CASCADE;

-- Verify the table is removed
-- SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pending_live_orders';
