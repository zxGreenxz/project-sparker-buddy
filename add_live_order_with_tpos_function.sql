-- Migration: Create function to add live order with TPOS data atomically
-- This ensures both insert to live_orders and update to live_products happen in one transaction
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION add_live_order_with_tpos(
  p_order_code TEXT,
  p_facebook_comment_id TEXT,
  p_session_id UUID,
  p_phase_id UUID,
  p_product_id UUID,
  p_is_oversell BOOLEAN,
  p_tpos_order_id TEXT,
  p_code_tpos_order_id TEXT
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_sold_quantity INTEGER;
  v_product_code TEXT;
  v_product_name TEXT;
  v_result json;
BEGIN
  -- Insert order
  INSERT INTO live_orders (
    order_code, 
    facebook_comment_id, 
    live_session_id, 
    live_phase_id, 
    live_product_id, 
    quantity, 
    is_oversell
  ) VALUES (
    p_order_code,
    p_facebook_comment_id,
    p_session_id,
    p_phase_id,
    p_product_id,
    1,
    p_is_oversell
  );

  -- Update product (atomic with insert above)
  UPDATE live_products
  SET 
    sold_quantity = sold_quantity + 1,
    tpos_order_id = COALESCE(p_tpos_order_id, tpos_order_id),
    code_tpos_order_id = COALESCE(p_code_tpos_order_id, code_tpos_order_id)
  WHERE id = p_product_id
  RETURNING sold_quantity, product_code, product_name 
  INTO v_new_sold_quantity, v_product_code, v_product_name;

  -- Build and return result
  v_result := json_build_object(
    'sold_quantity', v_new_sold_quantity,
    'product_code', v_product_code,
    'product_name', v_product_name,
    'success', true
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION add_live_order_with_tpos TO authenticated;
