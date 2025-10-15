-- Add product_type column to facebook_pending_orders table
-- Values: hang_dat (default), hang_le, hang_soluong

ALTER TABLE public.facebook_pending_orders 
ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'hang_dat' CHECK (product_type IN ('hang_dat', 'hang_le', 'hang_soluong'));

COMMENT ON COLUMN public.facebook_pending_orders.product_type IS 'Type of product order: hang_dat (pre-order), hang_le (retail), hang_soluong (quantity-based)';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_facebook_pending_orders_product_type 
ON public.facebook_pending_orders(product_type);
