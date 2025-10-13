-- Migration: Create pending_live_orders table
-- Purpose: Store Facebook comment orders before matching with live_products
-- Run this migration in Supabase SQL Editor

-- Create pending_live_orders table
create table if not exists public.pending_live_orders (
  id uuid primary key default gen_random_uuid(),
  comment_id text not null,
  comment_text text,
  customer_name text,
  facebook_user_id text,
  product_codes text[] not null, -- Array of product codes like ['N217', 'N218']
  session_index text,
  tpos_order_code text,
  video_id text,
  created_at timestamp with time zone default now(),
  processed boolean default false,
  processed_at timestamp with time zone,
  error_message text,
  
  -- Unique constraint to prevent duplicate comment processing
  constraint pending_live_orders_comment_id_key unique(comment_id)
);

-- Index for querying unprocessed orders (WHERE clause optimization)
create index if not exists idx_pending_live_orders_processed 
  on public.pending_live_orders(processed) 
  where processed = false;

-- Index for timestamp queries (ORDER BY optimization)
create index if not exists idx_pending_live_orders_created_at 
  on public.pending_live_orders(created_at desc);

-- Enable Row Level Security
alter table public.pending_live_orders enable row level security;

-- Policy: Allow authenticated users to read all pending orders
create policy "Allow authenticated users to read pending orders"
  on public.pending_live_orders for select
  to authenticated
  using (true);

-- Policy: Allow service role to insert/update (for edge functions)
create policy "Allow service role to manage pending orders"
  on public.pending_live_orders for all
  to service_role
  using (true);

-- Enable realtime updates for live data synchronization
alter publication supabase_realtime add table public.pending_live_orders;

-- Add comment for documentation
comment on table public.pending_live_orders is 'Stores pending Facebook comment orders before they are matched with live_products. Processing happens in /live-products page.';
comment on column public.pending_live_orders.product_codes is 'Array of extracted product codes (e.g., [N217, N218]) from comment text';
comment on column public.pending_live_orders.session_index is 'TPOS order session index (Code field from TPOS response)';
comment on column public.pending_live_orders.processed is 'Whether this order has been processed and matched with live_products';
