import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🔍 Checking token expiry status for all active tokens...');

    // Fetch all active tokens
    const { data: tokens, error: fetchError } = await supabase
      .from('tpos_config')
      .select('id, token_type, last_refreshed_at, refresh_interval_days, auto_refresh_enabled')
      .eq('is_active', true);

    if (fetchError) {
      throw fetchError;
    }

    if (!tokens || tokens.length === 0) {
      console.log('⚠️ No active tokens found');
      return new Response(
        JSON.stringify({ message: 'No active tokens to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const updates = [];
    const now = new Date();

    for (const token of tokens) {
      if (!token.auto_refresh_enabled) {
        console.log(`⏭️ Skipping ${token.token_type} - auto refresh disabled`);
        continue;
      }

      const lastRefreshed = new Date(token.last_refreshed_at);
      const daysSinceRefresh = Math.floor((now.getTime() - lastRefreshed.getTime()) / (1000 * 60 * 60 * 24));
      const daysUntilExpiry = token.refresh_interval_days - daysSinceRefresh;

      let newStatus = 'active';
      if (daysUntilExpiry <= 0) {
        newStatus = 'expired';
        console.log(`🔴 ${token.token_type} token EXPIRED (${Math.abs(daysUntilExpiry)} days overdue)`);
      } else if (daysUntilExpiry <= 2) {
        newStatus = 'warning';
        console.log(`🟡 ${token.token_type} token WARNING (expires in ${daysUntilExpiry} days)`);
      } else {
        console.log(`🟢 ${token.token_type} token ACTIVE (expires in ${daysUntilExpiry} days)`);
      }

      updates.push({
        id: token.id,
        token_type: token.token_type,
        newStatus,
        daysUntilExpiry,
      });

      // Update token status
      const { error: updateError } = await supabase
        .from('tpos_config')
        .update({ token_status: newStatus })
        .eq('id', token.id);

      if (updateError) {
        console.error(`❌ Error updating ${token.token_type} token status:`, updateError);
      }
    }

    console.log(`✅ Token expiry check completed. Processed ${updates.length} tokens`);

    return new Response(
      JSON.stringify({
        success: true,
        checked_tokens: updates.length,
        updates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error checking token expiry:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
