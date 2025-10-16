import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Updated: 2025-01-15 - Use tpos_credentials table
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
    const order = url.searchParams.get('order') || 'reverse_chronological';

    if (!pageId || !postId) {
      return new Response(
        JSON.stringify({ error: 'pageId and postId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch Facebook token from tpos_credentials
    const { data: tokenData, error: tokenError } = await supabaseClient
      .from('tpos_credentials')
      .select('bearer_token')
      .eq('token_type', 'facebook')
      .not('bearer_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tokenError || !tokenData?.bearer_token) {
      console.error('❌ Facebook token not found:', tokenError);
      return new Response(
        JSON.stringify({ error: 'Facebook Bearer Token not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const bearerToken = tokenData.bearer_token;

    // ========== STEP 1: Try TPOS API first ==========
    try {
      let tposUrl = `https://tomato.tpos.vn/api/facebook-graph/comment?pageid=${pageId}&facebook_type=Page&postId=${postId}&limit=${limit}&order=${order}`;
      if (after) {
        tposUrl += `&after=${after}`;
      }

      console.log(`🔄 Fetching from TPOS API: postId=${postId}, limit=${limit}`);

      const response = await fetch(tposUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          'accept': 'application/json, text/javascript, */*; q=0.01',
          'tposappversion': '5.9.10.1',
          'x-requested-with': 'XMLHttpRequest',
        },
      });

      // ========== STEP 2A: Handle deleted post (400 error) ==========
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`⚠️ TPOS API error: ${response.status} - ${errorText}`);
        
        if (response.status === 400 && errorText.includes('Object with ID')) {
          console.log(`🗑️ Post ${postId} deleted - marking all comments as deleted`);
          
          const { error: updateError } = await supabaseClient
            .from('facebook_comments_archive')
            .update({ 
              is_deleted: true,
              updated_at: new Date().toISOString()
            })
            .eq('facebook_post_id', postId)
            .eq('is_deleted', false);
          
          if (updateError) {
            console.error('❌ Error marking comments as deleted:', updateError);
          } else {
            console.log(`✅ Marked all comments for post ${postId} as deleted`);
          }
          
          return new Response(
            JSON.stringify({ 
              data: [], 
              paging: {}, 
              source: 'deleted' 
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        throw new Error(`TPOS API failed: ${response.status}`);
      }

      // ========== STEP 2B: TPOS success - Parse and save to DB ==========
      const data = await response.json();
      const comments = data?.data || [];
      
      console.log(`✅ TPOS API returned ${comments.length} comments`);
      
      // ALWAYS save to database when TPOS API is successful
      if (comments.length > 0) {
        console.log(`💾 Saving ${comments.length} comments to DB...`);
        
        const upsertData = comments.map((comment: any) => ({
          facebook_comment_id: comment.id,
          facebook_post_id: postId,
          facebook_user_id: comment.from?.id || null,
          facebook_user_name: comment.from?.name || null,
          comment_message: comment.message || '',
          comment_created_time: comment.created_time,
          like_count: comment.like_count || 0,
          is_deleted: false,
          last_fetched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }));

        const { error: upsertError } = await supabaseClient
          .from('facebook_comments_archive')
          .upsert(upsertData, { 
            onConflict: 'facebook_comment_id',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          console.error('❌ DB save error:', upsertError.message);
        } else {
          console.log(`✅ Saved ${upsertData.length} comments to DB`);
        }
      }
      
      // Extract paging cursor from response
      let responsePayload = data;
      if (responsePayload.paging && !responsePayload.paging.cursors?.after && responsePayload.paging.next) {
        try {
          const nextUrl = new URL(responsePayload.paging.next);
          const afterCursor = nextUrl.searchParams.get('after');
          if (afterCursor) {
            if (!responsePayload.paging.cursors) {
              responsePayload.paging.cursors = {};
            }
            responsePayload.paging.cursors.after = afterCursor;
            console.log(`📍 Extracted cursor: ${afterCursor}`);
          }
        } catch (e) {
          console.warn("Could not parse paging URL:", e instanceof Error ? e.message : String(e));
        }
      }

      return new Response(
        JSON.stringify({
          ...responsePayload,
          source: 'tpos_api'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
      
    } catch (tposError) {
      // ========== STEP 3: TPOS failed - Fallback to DB (read-only) ==========
      console.log(`🔄 TPOS unavailable, reading from DB...`);
      console.error('TPOS error:', tposError instanceof Error ? tposError.message : String(tposError));
      
      const { data: dbComments, error: dbError } = await supabaseClient
        .from('facebook_comments_archive')
        .select('*')
        .eq('facebook_post_id', postId)
        .eq('is_deleted', false)
        .order('comment_created_time', { ascending: order === 'chronological' })
        .limit(parseInt(limit));

      if (dbError) {
        console.error('❌ DB query failed:', dbError);
        return new Response(
          JSON.stringify({ 
            error: 'Both TPOS API and database unavailable',
            details: dbError.message
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Transform DB format to TPOS format
      const transformedData = {
        data: (dbComments || []).map(comment => ({
          id: comment.facebook_comment_id,
          message: comment.comment_message,
          from: {
            name: comment.facebook_user_name,
            id: comment.facebook_user_id
          },
          created_time: comment.comment_created_time,
          like_count: comment.like_count
        })),
        paging: { cursors: {} }
      };

      console.log(`✅ Retrieved ${dbComments?.length || 0} comments from DB`);

      return new Response(
        JSON.stringify({
          ...transformedData,
          source: 'database'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
  } catch (error) {
    console.error('❌ Edge function error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
