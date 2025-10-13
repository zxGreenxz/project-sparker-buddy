import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Extract all product codes from comment text
 * Pattern: N followed by numbers and optional letters (e.g., N55, N236L, N217)
 */
function extractProductCodes(text: string): string[] {
  const pattern = /N\d+[A-Z]*/gi;
  const matches = text.match(pattern);
  
  if (!matches) return [];
  
  const codes = matches.map(m => m.toUpperCase().trim());
  return [...new Set(codes)];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pendingOrderId, commentText, customerName, facebookCommentId, sessionIndex } = await req.json();

    if (!pendingOrderId || !commentText) {
      throw new Error('Missing required fields: pendingOrderId, commentText');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Processing live orders for pending order:', pendingOrderId);
    console.log('Comment text:', commentText);

    // Extract product codes from comment
    const productCodes = extractProductCodes(commentText);
    console.log('Extracted product codes:', productCodes);

    if (productCodes.length === 0) {
      console.log('No product codes found in comment');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No product codes found',
          created: 0 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find matching live_products for today with these product codes
    const { data: liveProducts, error: liveProductsError } = await supabase
      .from('live_products')
      .select('id, product_code, sold_quantity, prepared_quantity, created_at')
      .in('product_code', productCodes)
      .gte('created_at', today.toISOString())
      .lt('created_at', tomorrow.toISOString())
      .order('created_at', { ascending: false });

    if (liveProductsError) {
      console.error('Error fetching live_products:', liveProductsError);
      throw liveProductsError;
    }

    console.log('Found live_products:', liveProducts?.length || 0);

    if (!liveProducts || liveProducts.length === 0) {
      console.log('No matching live_products found for today');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No matching live_products found',
          created: 0,
          productCodes 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const createdOrders = [];
    const errors = [];

    // Create live_orders for each matching product
    for (const liveProduct of liveProducts) {
      try {
        // Check if order already exists to prevent duplicates
        const { data: existingOrder } = await supabase
          .from('live_orders')
          .select('id')
          .eq('facebook_comment_id', facebookCommentId)
          .eq('live_product_id', liveProduct.id)
          .maybeSingle();

        if (existingOrder) {
          console.log(`Order already exists for product ${liveProduct.product_code}`);
          continue;
        }

        // Calculate if oversell
        const newSoldQuantity = (liveProduct.sold_quantity || 0) + 1;
        const isOversell = newSoldQuantity > (liveProduct.prepared_quantity || 0);

        // Create live_order
        const { data: liveOrder, error: insertError } = await supabase
          .from('live_orders')
          .insert({
            live_product_id: liveProduct.id,
            session_index: sessionIndex,
            customer_name: customerName,
            facebook_comment_id: facebookCommentId,
            comment_text: commentText,
            is_oversell: isOversell,
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error creating live_order for ${liveProduct.product_code}:`, insertError);
          errors.push({ productCode: liveProduct.product_code, error: insertError.message });
          continue;
        }

        // Update sold_quantity in live_products
        const { error: updateError } = await supabase
          .from('live_products')
          .update({ 
            sold_quantity: newSoldQuantity,
            updated_at: new Date().toISOString()
          })
          .eq('id', liveProduct.id);

        if (updateError) {
          console.error(`Error updating sold_quantity for ${liveProduct.product_code}:`, updateError);
          errors.push({ productCode: liveProduct.product_code, error: updateError.message });
        } else {
          console.log(`✓ Created live_order for ${liveProduct.product_code} (${isOversell ? 'OVERSELL' : 'OK'})`);
          createdOrders.push({
            productCode: liveProduct.product_code,
            liveOrderId: liveOrder.id,
            isOversell
          });
        }
      } catch (error) {
        console.error(`Exception processing product ${liveProduct.product_code}:`, error);
        errors.push({ 
          productCode: liveProduct.product_code, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    console.log(`Processing complete: ${createdOrders.length} orders created, ${errors.length} errors`);

    return new Response(
      JSON.stringify({ 
        success: true,
        created: createdOrders.length,
        orders: createdOrders,
        errors: errors.length > 0 ? errors : undefined,
        productCodes
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in process-live-orders function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
