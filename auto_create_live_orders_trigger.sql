-- Migration: Auto-create live_orders from facebook_pending_orders
-- Purpose: Immediately create live_orders when comment is captured
-- Benefits: Real-time order creation, no frontend polling needed
-- Usage: Run this SQL in Supabase SQL Editor

-- ============================================================
-- STEP 1: Create function to extract product codes from text
-- ============================================================
CREATE OR REPLACE FUNCTION extract_product_codes(text_input TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  codes TEXT[];
BEGIN
  -- Extract all product codes matching pattern: N followed by digits and optional letters
  -- Examples: N55, N236L, N217
  SELECT ARRAY_AGG(DISTINCT match[1])
  INTO codes
  FROM regexp_matches(text_input, '(N\d+[A-Z]*)', 'gi') AS match;
  
  RETURN COALESCE(codes, ARRAY[]::TEXT[]);
END;
$$;

-- ============================================================
-- STEP 2: Create function to auto-create live_orders
-- ============================================================
CREATE OR REPLACE FUNCTION auto_create_live_orders_from_pending()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  product_codes TEXT[];
  code TEXT;
  live_prod RECORD;
  today_date DATE;
  new_order_id UUID;
  orders_created INT := 0;
BEGIN
  -- Get today's date for phase_date matching
  today_date := CURRENT_DATE;
  
  -- Extract product codes from comment_text
  product_codes := extract_product_codes(NEW.comment_text);
  
  -- Log extracted codes
  RAISE NOTICE 'Extracted product codes from comment %: %', NEW.facebook_comment_id, product_codes;
  
  -- If no codes found, exit early
  IF array_length(product_codes, 1) IS NULL THEN
    RAISE NOTICE 'No product codes found in comment %', NEW.facebook_comment_id;
    RETURN NEW;
  END IF;
  
  -- Loop through each extracted product code
  FOREACH code IN ARRAY product_codes
  LOOP
    -- Find matching live_product for this code and today's date
    SELECT 
      lp.id,
      lp.product_id,
      lp.sold_quantity,
      lp.prepared_quantity,
      lp.phase_date,
      p.product_code,
      p.product_name
    INTO live_prod
    FROM live_products lp
    JOIN products p ON p.id = lp.product_id
    WHERE (
      p.product_code = code OR
      p.base_product_code = code OR
      p.product_code ILIKE code || '%'
    )
    AND lp.phase_date = today_date
    ORDER BY 
      CASE 
        WHEN p.product_code = code THEN 1
        WHEN p.base_product_code = code THEN 2
        ELSE 3
      END
    LIMIT 1;
    
    -- If product found, create live_order
    IF live_prod.id IS NOT NULL THEN
      -- Check if order already exists (avoid duplicates)
      IF NOT EXISTS (
        SELECT 1 FROM live_orders 
        WHERE facebook_comment_id = NEW.facebook_comment_id 
        AND live_product_id = live_prod.id
      ) THEN
        -- Generate new order ID
        new_order_id := gen_random_uuid();
        
        -- Determine if oversell
        DECLARE
          is_oversell BOOLEAN;
        BEGIN
          is_oversell := (live_prod.sold_quantity + 1) > live_prod.prepared_quantity;
        END;
        
        -- Insert into live_orders
        INSERT INTO live_orders (
          id,
          live_product_id,
          session_index,
          facebook_comment_id,
          customer_name,
          comment_text,
          is_oversell,
          created_at
        ) VALUES (
          new_order_id,
          live_prod.id,
          NEW.session_index,
          NEW.facebook_comment_id,
          NEW.customer_name,
          NEW.comment_text,
          is_oversell,
          NOW()
        );
        
        -- Update sold_quantity in live_products
        UPDATE live_products
        SET sold_quantity = sold_quantity + 1
        WHERE id = live_prod.id;
        
        orders_created := orders_created + 1;
        
        RAISE NOTICE 'Created live_order for product % (%) - Total created: %', 
          live_prod.product_code, live_prod.product_name, orders_created;
      ELSE
        RAISE NOTICE 'Duplicate detected: Order already exists for comment % and product %', 
          NEW.facebook_comment_id, live_prod.product_code;
      END IF;
    ELSE
      RAISE NOTICE 'No matching live_product found for code: %', code;
    END IF;
  END LOOP;
  
  -- Log summary
  RAISE NOTICE 'Auto-create summary: % orders created from comment %', 
    orders_created, NEW.facebook_comment_id;
  
  RETURN NEW;
END;
$$;

-- ============================================================
-- STEP 3: Create trigger on facebook_pending_orders
-- ============================================================
DROP TRIGGER IF EXISTS trigger_auto_create_live_orders ON facebook_pending_orders;

CREATE TRIGGER trigger_auto_create_live_orders
  AFTER INSERT ON facebook_pending_orders
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_live_orders_from_pending();

-- ============================================================
-- STEP 4: Grant necessary permissions
-- ============================================================
GRANT EXECUTE ON FUNCTION extract_product_codes(TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auto_create_live_orders_from_pending() TO authenticated, service_role;

-- ============================================================
-- STEP 5: Add helpful comment
-- ============================================================
COMMENT ON FUNCTION auto_create_live_orders_from_pending() IS 
  'Automatically creates live_orders when facebook_pending_orders are inserted. Extracts product codes from comment_text and matches with live_products.';

COMMENT ON TRIGGER trigger_auto_create_live_orders ON facebook_pending_orders IS
  'Triggers auto-creation of live_orders immediately after facebook_pending_orders insert';

-- ============================================================
-- Verification Queries (Optional - Run to verify)
-- ============================================================

-- Check if function exists
-- SELECT proname, prosrc FROM pg_proc WHERE proname = 'auto_create_live_orders_from_pending';

-- Check if trigger exists
-- SELECT tgname, tgtype, tgenabled FROM pg_trigger WHERE tgname = 'trigger_auto_create_live_orders';

-- Test extract function
-- SELECT extract_product_codes('Test N55 and N236L with N217');
