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
    const { phones } = await req.json();

    if (!phones || !Array.isArray(phones) || phones.length === 0) {
      throw new Error('Phones array is required');
    }

    console.log('Fetching partner status for phones:', phones);

    const bearerToken = Deno.env.get('FACEBOOK_BEARER_TOKEN');
    if (!bearerToken) {
      console.error('FACEBOOK_BEARER_TOKEN not configured');
      throw new Error('Facebook bearer token not configured');
    }

    // Build phone query parameter - can search multiple phones separated by comma
    const phoneQuery = phones.join(',');
    const url = `https://tomato.tpos.vn/odata/Partner/ODataService.GetViewV2?Type=Customer&Active=true&Phone=${phoneQuery}&%24top=50&%24orderby=DateCreated+desc&%24filter=Type+eq+%27Customer%27&%24count=true`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json, text/javascript, */*; q=0.01',
        'Authorization': `Bearer ${bearerToken}`,
        'tposappversion': '5.9.10.1',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TPOS API error:', errorText);
      throw new Error(`TPOS API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Fetched ${data.value?.length || 0} partners`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error fetching partner status:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
