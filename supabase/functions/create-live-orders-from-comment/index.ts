import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SelectedProduct {
  code: string;
  name: string;
}

interface TPOSResponse {
  Id: string;
  SessionIndex: string;
  Code: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { comment, video, tposResponse, selectedProducts, phaseId, sessionId } = await req.json();

    console.log('Received request:', { 
      commentId: comment?.id, 
      videoId: video?.id, 
      tposResponse, 
      selectedProducts,
      phaseId,
      sessionId 
    });

    if (!comment || !tposResponse || !selectedProducts || !phaseId || !sessionId) {
      throw new Error('Missing required fields');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse product codes from selectedProducts
    const productCodes = (selectedProducts as SelectedProduct[]).map(p => p.code.trim());
    console.log('Product codes to process:', productCodes);

    const productsMapped: Array<{ productCode: string; liveProductId: string }> = [];
    const ordersCreated: string[] = [];
    let totalSoldQuantity = 0;

    // Process each product code
    for (const productCode of productCodes) {
      try {
        console.log(`Processing product code: ${productCode}`);

        // Query products table to find matching product and live_product
        // Logic: Match with variant (after "-") or product_code if variant is "-"
        const { data: products, error: productsError } = await supabase
          .from('products')
          .select('id, product_code, variant')
          .or(`product_code.eq.${productCode},variant.ilike.%- ${productCode}%,variant.ilike.%-${productCode}%`);

        if (productsError) {
          console.error(`Error querying products for ${productCode}:`, productsError);
          continue;
        }

        console.log(`Found ${products?.length || 0} products for code ${productCode}`);

        // Find the best match
        let matchedProduct = null;
        for (const product of products || []) {
          // Direct product_code match
          if (product.product_code === productCode) {
            matchedProduct = product;
            break;
          }

          // Variant match: extract code after "- "
          if (product.variant && product.variant !== '-') {
            const variantCode = product.variant.replace(/^-\s*/, '').trim();
            if (variantCode === productCode) {
              matchedProduct = product;
              break;
            }
          }

          // Fallback: if variant is "-" and product_code matches
          if (product.variant === '-' && product.product_code === productCode) {
            matchedProduct = product;
            break;
          }
        }

        if (!matchedProduct) {
          console.log(`No matching product found for code: ${productCode}`);
          continue;
        }

        console.log(`Matched product:`, matchedProduct);

        // Find corresponding live_product
        const { data: liveProducts, error: liveProductError } = await supabase
          .from('live_products')
          .select('id, product_code, sold_quantity')
          .eq('live_phase_id', phaseId)
          .eq('product_code', matchedProduct.product_code);

        if (liveProductError) {
          console.error(`Error querying live_products for ${matchedProduct.product_code}:`, liveProductError);
          continue;
        }

        if (!liveProducts || liveProducts.length === 0) {
          console.log(`No live_product found for product_code: ${matchedProduct.product_code}`);
          continue;
        }

        const liveProduct = liveProducts[0];
        console.log(`Found live_product:`, liveProduct);

        // Create live_order
        const { data: newOrder, error: insertError } = await supabase
          .from('live_orders')
          .insert({
            order_code: tposResponse.SessionIndex,
            live_product_id: liveProduct.id,
            live_phase_id: phaseId,
            live_session_id: sessionId,
            facebook_comment_id: comment.id,
            tpos_order_id: tposResponse.Id,
            code_tpos_order_id: tposResponse.Code,
            quantity: 1,
            order_date: new Date().toISOString(),
            is_oversell: false, // Will be calculated dynamically
          })
          .select()
          .single();

        if (insertError) {
          console.error(`Error inserting live_order:`, insertError);
          continue;
        }

        console.log(`Created live_order:`, newOrder);

        ordersCreated.push(newOrder.id);
        productsMapped.push({
          productCode,
          liveProductId: liveProduct.id,
        });

        // Update sold_quantity for the live_product
        const newSoldQuantity = (liveProduct.sold_quantity || 0) + 1;
        totalSoldQuantity += 1;

        const { error: updateError } = await supabase
          .from('live_products')
          .update({ sold_quantity: newSoldQuantity })
          .eq('id', liveProduct.id);

        if (updateError) {
          console.error(`Error updating sold_quantity for live_product ${liveProduct.id}:`, updateError);
        } else {
          console.log(`Updated sold_quantity for live_product ${liveProduct.id}: ${newSoldQuantity}`);
        }

      } catch (productError) {
        console.error(`Error processing product ${productCode}:`, productError);
      }
    }

    console.log(`Successfully created ${ordersCreated.length} orders`);

    return new Response(
      JSON.stringify({
        success: true,
        ordersCreated: ordersCreated.length,
        sessionIndex: tposResponse.SessionIndex,
        productsMapped,
        orderIds: ordersCreated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in create-live-orders-from-comment function:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
