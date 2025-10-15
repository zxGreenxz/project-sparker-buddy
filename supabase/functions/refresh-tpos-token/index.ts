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

    // Get the request body (may contain credentialId for manual refresh)
    const body = await req.json().catch(() => ({}));
    const { credentialId, username, password } = body;

    let credentialsToUse;
    let tokenType = 'tpos'; // default

    if (username && password) {
      // Manual refresh with provided credentials
      credentialsToUse = { username, password };
      console.log('🔄 Manual token refresh requested');
    } else if (credentialId) {
      // Manual refresh with specific credential
      const { data, error } = await supabase
        .from('tpos_credentials')
        .select('username, password, token_type')
        .eq('id', credentialId)
        .single();

      if (error || !data) {
        throw new Error('Credential not found');
      }
      credentialsToUse = data;
      tokenType = data.token_type || 'tpos';
      console.log(`🔄 Manual token refresh with saved credential for ${tokenType}`);
    } else {
      // Auto refresh - get active credential
      const { data, error } = await supabase
        .from('tpos_credentials')
        .select('username, password, token_type')
        .eq('is_active', true)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        console.log('⚠️ No active credentials found for auto-refresh');
        return new Response(
          JSON.stringify({ success: false, message: 'No active credentials configured' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      credentialsToUse = data;
      tokenType = data.token_type || 'tpos';
      console.log(`🔄 Auto token refresh with active credential for ${tokenType}`);
    }

    // Get new token from TPOS
    console.log('📞 Calling TPOS token endpoint...');
    const tokenResponse = await fetch('https://tomato.tpos.vn/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Origin': 'https://tomato.tpos.vn',
        'Referer': 'https://tomato.tpos.vn/',
        'tposappversion': '5.10.13.1',
        'x-tpos-lang': 'vi'
      },
      body: new URLSearchParams({
        grant_type: 'password',
        username: credentialsToUse.username,
        password: credentialsToUse.password,
        client_id: 'tmtWebApp'
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('❌ TPOS token request failed:', tokenResponse.status, errorText);
      throw new Error(`Failed to get token from TPOS: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();
    const newToken = tokenData.access_token;

    if (!newToken) {
      throw new Error('No access token in response');
    }

    console.log('✅ Got new token from TPOS');

    // Update the specific token based on credential's token_type
    const { error: updateError } = await supabase
      .from('tpos_config')
      .update({
        bearer_token: newToken,
        last_refreshed_at: new Date().toISOString(),
        token_status: 'active'
      })
      .eq('token_type', tokenType)
      .eq('is_active', true);

    if (updateError) {
      console.error(`❌ Error updating ${tokenType} token:`, updateError);
      throw updateError;
    }

    console.log(`✅ Token refresh completed successfully for ${tokenType}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `${tokenType.toUpperCase()} token refreshed successfully`,
        tokenType,
        refreshedAt: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error in refresh-tpos-token:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
