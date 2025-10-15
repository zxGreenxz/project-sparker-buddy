import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bearerToken, tokenType = 'tpos' } = await req.json();
    
    if (!bearerToken) {
      throw new Error('Bearer token is required');
    }

    if (!['tpos', 'facebook'].includes(tokenType)) {
      throw new Error('Invalid token type. Must be "tpos" or "facebook"');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Deactivate all tokens of this type first
    await supabase
      .from('tpos_config')
      .update({ is_active: false })
      .eq('token_type', tokenType);

    // Insert or update the new token
    const { error: upsertError } = await supabase
      .from('tpos_config')
      .upsert({
        bearer_token: bearerToken,
        token_type: tokenType,
        is_active: true,
        last_refreshed_at: new Date().toISOString(),
        token_status: 'active',
        auto_refresh_enabled: true,
        refresh_interval_days: 7,
      }, {
        onConflict: 'token_type',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('❌ Error saving token:', upsertError);
      throw upsertError;
    }
    
    const tokenLabel = tokenType === 'tpos' ? 'TPOS' : 'Facebook';
    console.log(`✅ ${tokenLabel} Bearer Token đã được lưu vào database tpos_config`);
    console.log('📝 Token sẽ được các Edge Functions khác sử dụng tự động');
    console.log(`🔄 Token sẽ tự động check expiry sau ${7} ngày`);
    
    return new Response(
      JSON.stringify({
        success: true,
        message: `${tokenType === 'tpos' ? 'TPOS' : 'Facebook'} Bearer Token đã được cập nhật thành công`,
        tokenType,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('❌ Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: (error as Error).message 
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
