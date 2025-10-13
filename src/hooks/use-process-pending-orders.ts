import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { parseVariant } from '@/lib/variant-utils';

interface PendingLiveOrder {
  id: string;
  comment_id: string;
  comment_text: string | null;
  customer_name: string | null;
  facebook_user_id: string | null;
  product_codes: string[];
  session_index: string | null;
  tpos_order_code: string | null;
  video_id: string | null;
  created_at: string;
  processed: boolean;
  processed_at: string | null;
  error_message: string | null;
}

interface LiveProduct {
  id: string;
  product_code: string;
  variant: string | null;
  live_session_id: string;
  live_phase_id: string | null;
  sold_quantity: number;
  prepared_quantity: number;
}

/**
 * Hook to automatically process pending Facebook comment orders
 * Matches product codes from comments with live_products and creates live_orders
 * Runs on mount and every 30 seconds while on /live-products page
 */
export function useProcessPendingOrders() {
  const queryClient = useQueryClient();

  const processPendingOrders = useCallback(async () => {
    console.log('[useProcessPendingOrders] 🔄 Starting to process pending orders...');

    try {
      // 1. Fetch unprocessed pending orders
      const { data: rawPendingOrders, error: fetchError } = await supabase
        .from('pending_live_orders' as any)
        .select('*')
        .eq('processed', false)
        .order('created_at', { ascending: true });
      
      const pendingOrders = (rawPendingOrders as unknown) as PendingLiveOrder[] | null;

      if (fetchError) {
        console.error('[useProcessPendingOrders] ❌ Error fetching:', fetchError);
        return;
      }

      if (!pendingOrders || pendingOrders.length === 0) {
        console.log('[useProcessPendingOrders] ✓ No pending orders to process');
        return;
      }

      console.log(`[useProcessPendingOrders] 📦 Found ${pendingOrders.length} pending orders`);

      // 2. Fetch all live_products with variants (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: liveSessions } = await supabase
        .from('live_sessions')
        .select('id')
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (!liveSessions || liveSessions.length === 0) {
        console.log('[useProcessPendingOrders] ⚠️ No recent live sessions found');
        return;
      }

      const sessionIds = liveSessions.map(s => s.id);

      const { data: rawLiveProducts, error: productsError } = await supabase
        .from('live_products')
        .select('id, product_code, variant, live_session_id, live_phase_id, sold_quantity, prepared_quantity')
        .in('live_session_id', sessionIds)
        .not('variant', 'is', null);
      
      const liveProducts = rawLiveProducts as LiveProduct[] | null;

      if (productsError) {
        console.error('[useProcessPendingOrders] ❌ Error fetching live_products:', productsError);
        return;
      }

      console.log(`[useProcessPendingOrders] 📊 Found ${liveProducts?.length || 0} live products with variants`);

      // 3. Process each pending order
      let processedCount = 0;
      let errorCount = 0;

      for (const pending of pendingOrders) {
        console.log(`\n[Processing] Pending order ${pending.id}:`);
        console.log(`  Product codes: [${pending.product_codes.join(', ')}]`);
        console.log(`  Session index: ${pending.session_index}`);

        let matchedProduct = null;
        let matchedCode = '';

        // Try to match each product code
        for (const productCode of pending.product_codes) {
          console.log(`  🔍 Looking for: "${productCode}"`);

          matchedProduct = liveProducts?.find(product => {
            // Handle old data without variant code
            if (!product.variant) {
              console.log(`    Skipping "${product.product_code}" - no variant (old data)`);
              return false;
            }

            const variantCode = parseVariant(product.variant).code;
            
            // Skip if variant code is empty (old format: variant name only)
            if (!variantCode || variantCode.trim() === '') {
              console.log(`    Skipping "${product.variant}" - no code part (old format)`);
              return false;
            }

            const normalized = variantCode.toUpperCase().trim();
            const isMatch = normalized === productCode;

            console.log(`    Checking: "${product.variant}" → code="${variantCode}" → normalized="${normalized}" → ${isMatch ? '✅ MATCH' : '✗'}`);

            return isMatch;
          });

          if (matchedProduct) {
            matchedCode = productCode;
            console.log(`  ✅ Found match! Product ID: ${matchedProduct.id}`);
            break;
          }
        }

        if (matchedProduct) {
          // Check oversell
          const isOversell = (matchedProduct.sold_quantity || 0) >= (matchedProduct.prepared_quantity || 0);

          // Create live_order
          const { data: newOrder, error: insertError } = await supabase
            .from('live_orders')
            .insert({
              facebook_comment_id: pending.comment_id,
              session_index: pending.session_index,
              live_product_id: matchedProduct.id,
              live_session_id: matchedProduct.live_session_id,
              live_phase_id: matchedProduct.live_phase_id,
              comment_text: pending.comment_text,
              customer_name: pending.customer_name,
              facebook_user_id: pending.facebook_user_id,
              is_oversell: isOversell,
            } as any)
            .select()
            .single();

          if (insertError) {
            console.error(`  ❌ Failed to create live_order:`, insertError);
            
            // Mark as processed with error
            await supabase
              .from('pending_live_orders' as any)
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
                error_message: insertError.message,
              })
              .eq('id', pending.id);

            errorCount++;
          } else {
            console.log(`  ✅ Created live_order successfully (ID: ${newOrder.id})`);

            // Update sold_quantity
            const newSoldQuantity = (matchedProduct.sold_quantity || 0) + 1;
            await supabase
              .from('live_products')
              .update({ sold_quantity: newSoldQuantity })
              .eq('id', matchedProduct.id);

            // Mark as processed
            await supabase
              .from('pending_live_orders' as any)
              .update({
                processed: true,
                processed_at: new Date().toISOString(),
              })
              .eq('id', pending.id);

            processedCount++;
          }
        } else {
          console.log(`  ⚠️ No matching product found`);
          
          // Mark as processed with error (no match)
          await supabase
            .from('pending_live_orders' as any)
            .update({
              processed: true,
              processed_at: new Date().toISOString(),
              error_message: `No matching product found for codes: ${pending.product_codes.join(', ')}`,
            })
            .eq('id', pending.id);

          errorCount++;
        }
      }

      console.log(`\n[useProcessPendingOrders] ✅ Processing complete:`);
      console.log(`  Processed: ${processedCount}`);
      console.log(`  Errors: ${errorCount}`);

      if (processedCount > 0) {
        toast.success(`Đã xử lý ${processedCount} đơn hàng từ Facebook Comments`);
        
        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ['live-products'] });
        queryClient.invalidateQueries({ queryKey: ['live-orders'] });
      }

      if (errorCount > 0) {
        toast.warning(`${errorCount} đơn hàng không thể xử lý (không tìm thấy sản phẩm)`);
      }

    } catch (error) {
      console.error('[useProcessPendingOrders] ❌ Unexpected error:', error);
    }
  }, [queryClient]);

  // Auto-process on mount and every 30 seconds
  useEffect(() => {
    processPendingOrders();

    const interval = setInterval(() => {
      processPendingOrders();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [processPendingOrders]);

  return { processPendingOrders };
}
