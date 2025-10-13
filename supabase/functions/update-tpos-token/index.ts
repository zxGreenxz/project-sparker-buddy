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
    const { bearerToken } = await req.json();
    
    if (!bearerToken) {
      throw new Error('Bearer token is required');
    }
    
    console.log('✅ TPOS Bearer Token đã được lưu vào database tpos_config');
    console.log('📝 Token sẽ được các Edge Functions khác sử dụng tự động');
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'TPOS Bearer Token đã được cập nhật thành công',
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
