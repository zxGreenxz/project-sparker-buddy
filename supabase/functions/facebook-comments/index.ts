import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pageId = url.searchParams.get('pageId');
    const postId = url.searchParams.get('postId');
    const limit = url.searchParams.get('limit') || '100';
    const after = url.searchParams.get('after');
    const order = url.searchParams.get('order') || 'reverse_chronological'; // Accept order param

    if (!pageId || !postId) {
      return new Response(
        JSON.stringify({ error: 'pageId and postId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = Deno.env.get('FACEBOOK_BEARER_TOKEN');
    if (!bearerToken) {
      console.error('FACEBOOK_BEARER_TOKEN not configured');
      return new Response(
        JSON.stringify({ error: 'Bearer token not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let tposUrl = `https://tomato.tpos.vn/api/facebook-graph/comment?pageid=${pageId}&facebook_type=Page&postId=${postId}&limit=${limit}&order=${order}`;
    if (after) {
      tposUrl += `&after=${after}`;
    }

    console.log(`Fetching comments from URL: ${tposUrl}`);

    const response = await fetch(
      tposUrl,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'tposappversion': '5.9.10.1',
          'x-requested-with': 'XMLHttpRequest',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TPOS API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ error: `TPOS API error: ${response.status}`, details: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log('TPOS API response:', {
      hasData: !!data,
      isArray: Array.isArray(data),
      dataLength: data?.data?.length || (Array.isArray(data) ? data.length : 0),
      hasPaging: !!data?.paging,
      hasCursors: !!data?.paging?.cursors,
      afterCursor: data?.paging?.cursors?.after,
      nextUrl: data?.paging?.next
    });
    
    let responsePayload;

    if (Array.isArray(data)) {
      responsePayload = { data: data, paging: { cursors: {} } };
    } else if (data && data.data) {
      responsePayload = data;
      // Robustly handle paging: if cursors.after is missing, try to parse from `next` URL
      if (responsePayload.paging && !responsePayload.paging.cursors?.after && responsePayload.paging.next) {
        try {
          const nextUrl = new URL(responsePayload.paging.next);
          const afterCursor = nextUrl.searchParams.get('after');
          if (afterCursor) {
            if (!responsePayload.paging.cursors) {
              responsePayload.paging.cursors = {};
            }
            responsePayload.paging.cursors.after = afterCursor;
            console.log(`Extracted 'after' cursor from next URL: ${afterCursor}`);
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          console.warn("Could not parse 'next' URL in paging object:", errorMsg);
        }
      }
    } else {
      responsePayload = { data: [], paging: { cursors: {} } };
    }

    console.log(`Successfully fetched ${responsePayload.data?.length || 0} comments`);

    return new Response(
      JSON.stringify(responsePayload),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in facebook-comments function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});