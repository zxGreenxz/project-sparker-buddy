-- =====================================================
-- COMPLETE DATABASE SCHEMA FOR LIVE PRODUCTS SYSTEM
-- =====================================================

-- Table: live_sessions (Phiên livestream)
CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date DATE NOT NULL,
  supplier_name TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  facebook_post_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: live_phases (Các phiên trong ngày: Sáng/Chiều)
CREATE TABLE IF NOT EXISTS public.live_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_session_id UUID REFERENCES public.live_sessions(id) ON DELETE CASCADE,
  phase_date DATE NOT NULL,
  phase_type TEXT NOT NULL CHECK (phase_type IN ('morning', 'evening')),
  start_time TIME NOT NULL DEFAULT '00:00:00',
  end_time TIME NOT NULL DEFAULT '23:59:59',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: live_products (Sản phẩm trong phiên live)
CREATE TABLE IF NOT EXISTS public.live_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_phase_id UUID REFERENCES public.live_phases(id) ON DELETE CASCADE,
  product_id UUID,
  product_code TEXT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0,
  sold_quantity INTEGER DEFAULT 0,
  price DECIMAL(12,2),
  product_images TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: live_orders (Đơn hàng từ comments)
CREATE TABLE IF NOT EXISTS public.live_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  live_product_id UUID REFERENCES public.live_products(id) ON DELETE CASCADE,
  live_phase_id UUID REFERENCES public.live_phases(id) ON DELETE CASCADE,
  facebook_comment_id TEXT,
  customer_name TEXT,
  quantity INTEGER DEFAULT 1,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: facebook_pending_orders (Comments chờ xử lý)
CREATE TABLE IF NOT EXISTS public.facebook_pending_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facebook_comment_id TEXT UNIQUE NOT NULL,
  facebook_post_id TEXT,
  comment_text TEXT,
  customer_name TEXT,
  session_index TEXT,
  comment_type TEXT DEFAULT 'hang_dat',
  order_count INTEGER DEFAULT 0,
  created_time TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_live_phases_session ON live_phases(live_session_id);
CREATE INDEX IF NOT EXISTS idx_live_phases_date ON live_phases(phase_date);
CREATE INDEX IF NOT EXISTS idx_live_phases_times ON live_phases(phase_date, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_live_products_phase ON live_products(live_phase_id);
CREATE INDEX IF NOT EXISTS idx_live_orders_product ON live_orders(live_product_id);
CREATE INDEX IF NOT EXISTS idx_live_orders_phase ON live_orders(live_phase_id);
CREATE INDEX IF NOT EXISTS idx_facebook_pending_created ON facebook_pending_orders(created_time);
CREATE INDEX IF NOT EXISTS idx_facebook_pending_processed ON facebook_pending_orders(processed) WHERE processed = FALSE;

-- Function: Create live phases with time ranges
CREATE OR REPLACE FUNCTION public.create_live_phases(session_id uuid, start_date date)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.live_phases (live_session_id, phase_date, phase_type, start_time, end_time)
  VALUES 
    (session_id, start_date, 'morning', '00:00:00', '12:30:00'),
    (session_id, start_date, 'evening', '12:31:00', '23:59:59'),
    (session_id, start_date + INTERVAL '1 day', 'morning', '00:00:00', '12:30:00'),
    (session_id, start_date + INTERVAL '1 day', 'evening', '12:31:00', '23:59:59'),
    (session_id, start_date + INTERVAL '2 days', 'morning', '00:00:00', '12:30:00'),
    (session_id, start_date + INTERVAL '2 days', 'evening', '12:31:00', '23:59:59');
END;
$function$;

-- Enable RLS
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facebook_pending_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow authenticated users full access
CREATE POLICY "Allow authenticated users full access to live_sessions"
  ON public.live_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to live_phases"
  ON public.live_phases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to live_products"
  ON public.live_products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to live_orders"
  ON public.live_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Allow authenticated users full access to facebook_pending_orders"
  ON public.facebook_pending_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime
ALTER TABLE public.live_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.live_phases REPLICA IDENTITY FULL;
ALTER TABLE public.live_products REPLICA IDENTITY FULL;
ALTER TABLE public.live_orders REPLICA IDENTITY FULL;
ALTER TABLE public.facebook_pending_orders REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_phases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.live_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.facebook_pending_orders;