-- Add missing columns to existing tables

-- Add columns to facebook_pages
ALTER TABLE public.facebook_pages
ADD COLUMN IF NOT EXISTS crm_team_id TEXT,
ADD COLUMN IF NOT EXISTS crm_team_name TEXT;

-- Add columns to products
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS variant TEXT;

-- Add name column to facebook_pending_orders (alias for customer_name for backward compatibility)
ALTER TABLE public.facebook_pending_orders
ADD COLUMN IF NOT EXISTS name TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS tpos_order_id TEXT,
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Create goods_receiving_items table (was missing)
CREATE TABLE IF NOT EXISTS public.goods_receiving_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receiving_id UUID REFERENCES public.goods_receiving(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_code TEXT,
  product_name TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facebook_pending_name ON facebook_pending_orders(name) WHERE name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_goods_receiving_items_receiving ON goods_receiving_items(goods_receiving_id);

-- Enable RLS
ALTER TABLE public.goods_receiving_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY "Allow authenticated users full access to goods_receiving_items"
  ON public.goods_receiving_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Add more missing columns to live_orders
ALTER TABLE public.live_orders
ADD COLUMN IF NOT EXISTS order_code TEXT,
ADD COLUMN IF NOT EXISTS code_tpos_order_id TEXT,
ADD COLUMN IF NOT EXISTS live_session_id UUID REFERENCES public.live_sessions(id),
ADD COLUMN IF NOT EXISTS is_oversell BOOLEAN DEFAULT FALSE;

-- Add index on live_orders
CREATE INDEX IF NOT EXISTS idx_live_orders_session ON live_orders(live_session_id) WHERE live_session_id IS NOT NULL;