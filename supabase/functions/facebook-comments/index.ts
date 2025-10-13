import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    let data: any = null;
    let isFromDatabase = false;
    let isObjectDeleted = false;

    // Try to fetch from TPOS API first
    try {
      let tposUrl = `https://tomato.tpos.vn/api/facebook-graph/comment?pageid=${pageId}&facebook_type=Page&postId=${postId}&limit=${limit}&order=${order}`;
      if (after) {
        tposUrl += `&after=${after}`;
      }

      console.log(`Fetching comments from TPOS API: ${tposUrl}`);

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
        console.warn('⚠️ TPOS API error:', response.status, errorText);
        
        // Check if error is "Object with ID does not exist" (post/comment deleted)
        if (response.status === 400 && errorText.includes('Object with ID')) {
          console.log(`🗑️ Post ${postId} deleted by TPOS/Facebook - marking all comments as deleted`);
          isObjectDeleted = true;
          
          // Mark all existing non-deleted comments for this post as deleted
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
            console.log(`✅ Marked all non-deleted comments for post ${postId} as deleted`);
          }
        }
        
        throw new Error(`TPOS API failed: ${response.status}`);
      }

      data = await response.json();
      console.log('✅ TPOS API response:', {
        hasData: !!data,
        isArray: Array.isArray(data),
        dataLength: data?.data?.length || (Array.isArray(data) ? data.length : 0),
        hasPaging: !!data?.paging,
      });
      
      // Save comments to database (TPOS API successful)
      const comments = data?.data || [];
      if (comments.length > 0) {
        console.log(`💾 Saving ${comments.length} comments to database`);
        
        const upsertData = comments.map((comment: any) => ({
          facebook_comment_id: comment.id,
          facebook_post_id: postId,
          facebook_user_id: comment.from?.id || null,
          facebook_user_name: comment.from?.name || null,
          comment_message: comment.message || '',
          comment_created_time: comment.created_time,
          like_count: comment.like_count || 0,
          is_deleted: false, // TPOS API successful = not deleted
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
          console.warn('⚠️ Could not save comments:', upsertError.message);
        } else {
          console.log(`✅ Successfully saved ${upsertData.length} comments to database`);
        }
      }
      
    } catch (tposError) {
      console.log('🔄 TPOS API unavailable, falling back to database...');
      
      // Fallback to database if object was deleted or TPOS failed
      if (isObjectDeleted) {
        console.log(`🗑️ Post ${postId} is deleted - returning empty result`);
        return new Response(
          JSON.stringify({ 
            data: [], 
            paging: {}, 
            source: 'database_deleted' 
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
            status: 200 
          }
        );
      }
      
      // Fallback: Query non-deleted comments from database
      try {
        const { data: dbComments, error: dbError } = await supabaseClient
          .from('facebook_comments_archive')
          .select('*')
          .eq('facebook_post_id', postId)
          .eq('is_deleted', false) // Only fetch non-deleted comments
          .order('comment_created_time', { ascending: order === 'chronological' })
          .limit(parseInt(limit));

        if (dbError) {
          console.error('❌ Database query failed:', dbError);
          return new Response(
            JSON.stringify({ 
              error: 'Both TPOS API and database unavailable',
              details: tposError instanceof Error ? tposError.message : 'Unknown'
            }),
            { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Transform database format to TPOS API format
        data = {
          data: dbComments.map(comment => ({
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

        isFromDatabase = true;
        console.log(`✅ Retrieved ${dbComments.length} non-deleted comments from database`);
      } catch (fallbackError) {
        console.error('❌ Fallback failed:', fallbackError);
        return new Response(
          JSON.stringify({ 
            error: 'Failed to retrieve comments from any source',
            details: fallbackError instanceof Error ? fallbackError.message : 'Unknown'
          }),
          { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
    
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

    console.log(`Successfully fetched ${responsePayload.data?.length || 0} comments from ${isFromDatabase ? 'database' : 'TPOS API'}`);

    return new Response(
      JSON.stringify({
        ...responsePayload,
        source: isFromDatabase ? 'database' : 'tpos_api'
      }),
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