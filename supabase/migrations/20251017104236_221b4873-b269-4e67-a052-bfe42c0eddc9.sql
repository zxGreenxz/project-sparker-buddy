-- =====================================================
-- COMPREHENSIVE DATABASE SCHEMA - ALL MISSING TABLES
-- =====================================================

-- Table: activity_logs (User activity tracking)
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  username TEXT,
  action TEXT NOT NULL,
  table_name TEXT,
  record_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: customers (Customer information)
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  idkh TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  facebook_id TEXT,
  customer_status TEXT DEFAULT 'active',
  info_status TEXT,
  notes TEXT,
  crm_team_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: facebook_pages (Facebook page management)
CREATE TABLE IF NOT EXISTS public.facebook_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT UNIQUE NOT NULL,
  page_name TEXT NOT NULL,
  access_token TEXT,
  page_access_token TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: facebook_comments (Facebook comments tracking)
CREATE TABLE IF NOT EXISTS public.facebook_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_comment_id TEXT UNIQUE NOT NULL,
  facebook_post_id TEXT,
  facebook_user_id TEXT,
  comment_text TEXT,
  customer_name TEXT,
  comment_type TEXT,
  created_time TIMESTAMPTZ,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: products (Product catalog)
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_code TEXT UNIQUE NOT NULL,
  product_name TEXT NOT NULL,
  purchase_price DECIMAL(12,2),
  selling_price DECIMAL(12,2),
  stock_quantity INTEGER DEFAULT 0,
  unit TEXT,
  supplier_name TEXT,
  tpos_product_id TEXT,
  tpos_image_url TEXT,
  product_images TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: suppliers (Supplier information)
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name TEXT UNIQUE NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: purchase_orders (Purchase orders)
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT UNIQUE NOT NULL,
  supplier_name TEXT,
  order_date DATE NOT NULL,
  total_amount DECIMAL(12,2),
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: purchase_order_items (Items in purchase orders)
CREATE TABLE IF NOT EXISTS public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  product_code TEXT,
  product_name TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2),
  total_price DECIMAL(12,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: goods_receiving (Goods receiving records)
CREATE TABLE IF NOT EXISTS public.goods_receiving (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receiving_code TEXT UNIQUE NOT NULL,
  purchase_order_id UUID REFERENCES public.purchase_orders(id),
  supplier_name TEXT,
  receiving_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: tpos_credentials (TPOS API credentials)
CREATE TABLE IF NOT EXISTS public.tpos_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name TEXT,
  api_key TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_type TEXT,
  bearer_token TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: crm_teams (CRM team information)
CREATE TABLE IF NOT EXISTS public.crm_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT UNIQUE NOT NULL,
  team_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: livestream_reports (Livestream performance reports)
CREATE TABLE IF NOT EXISTS public.livestream_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL,
  live_session_id UUID REFERENCES public.live_sessions(id),
  total_viewers INTEGER,
  total_orders INTEGER,
  total_revenue DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_facebook ON customers(facebook_id);
CREATE INDEX IF NOT EXISTS idx_facebook_comments_post ON facebook_comments(facebook_post_id);
CREATE INDEX IF NOT EXISTS idx_facebook_comments_user ON facebook_comments(facebook_user_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(product_code);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_name);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_date ON purchase_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_order ON purchase_order_items(purchase_order_id);
CREATE INDEX IF NOT EXISTS idx_goods_receiving_date ON goods_receiving(receiving_date);

-- Enable RLS on all tables
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goods_receiving ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tpos_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.livestream_reports ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access to activity_logs"
  ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to customers"
  ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to facebook_pages"
  ON public.facebook_pages FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to facebook_comments"
  ON public.facebook_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to products"
  ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to suppliers"
  ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to purchase_orders"
  ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to purchase_order_items"
  ON public.purchase_order_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to goods_receiving"
  ON public.goods_receiving FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to tpos_credentials"
  ON public.tpos_credentials FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to crm_teams"
  ON public.crm_teams FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to livestream_reports"
  ON public.livestream_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for key tables
ALTER TABLE public.facebook_comments REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.facebook_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;