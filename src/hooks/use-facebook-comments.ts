import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { FacebookVideo, FacebookComment, TPOSOrder } from "@/types/facebook";

interface UseFacebookCommentsProps {
  pageId: string;
  videoId?: string;
  isAutoRefresh?: boolean;
}

export function useFacebookComments({ pageId, videoId, isAutoRefresh = true }: UseFacebookCommentsProps) {
  const queryClient = useQueryClient();
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(null);
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const allCommentIdsRef = useRef<Set<string>>(new Set());
  const [errorCount, setErrorCount] = useState(0);
  const [hasError, setHasError] = useState(false);
  const lastKnownCountRef = useRef<number>(0);
  const isCheckingNewCommentsRef = useRef(false);
  const deletedCountRef = useRef<number>(0); // Track deleted comments

  // Realtime check for new comments (only when live)
  useEffect(() => {
    if (!videoId || !selectedVideo || !isAutoRefresh || selectedVideo.statusLive !== 1) {
      return;
    }

    const checkForNewComments = async () => {
      if (isCheckingNewCommentsRef.current) return;
      
      isCheckingNewCommentsRef.current = true;
      
      try {
        // 1. Count non-deleted comments in DB
        const { count: dbCount } = await supabase
          .from('facebook_comments_archive' as any)
          .select('*', { count: 'exact', head: true })
          .eq('facebook_post_id', videoId)
          .eq('is_deleted', false);
        
        const currentDbCount = dbCount || 0;
        const tposCount = selectedVideo.countComment || 0;
        
        console.log(`[Realtime Hook] Video: ${videoId}`);
        console.log(`  DB: ${currentDbCount}, TPOS: ${tposCount}, Deleted: ${deletedCountRef.current}, Last TPOS: ${lastKnownCountRef.current}`);
        
        // 2. Check if TPOS deleted comments (TPOS count decreased)
        if (lastKnownCountRef.current > 0 && tposCount < lastKnownCountRef.current) {
          const deletedThisTime = lastKnownCountRef.current - tposCount;
          deletedCountRef.current += deletedThisTime;
          console.log(`[Realtime Hook] ⚠️ TPOS deleted ${deletedThisTime} comments (Total deleted: ${deletedCountRef.current})`);
          
          // Also update expected count immediately
          lastKnownCountRef.current = tposCount;
        }
        
        // 3. Calculate expected DB count: TPOS count + deleted count
        const expectedDbCount = tposCount + deletedCountRef.current;
        console.log(`  Expected DB count: ${tposCount} + ${deletedCountRef.current} = ${expectedDbCount}`);
        
        // 4. Check if we need to fetch new comments
        if (currentDbCount < expectedDbCount) {
          const newCommentsCount = expectedDbCount - currentDbCount;
          console.log(`[Realtime Hook] 📥 Fetching ${newCommentsCount} new comments`);
          
          const { data: { session } } = await supabase.auth.getSession();
          
          const response = await fetch(
            `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${videoId}&limit=100&order=reverse_chronological`,
            {
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          const result = await response.json();
          
          // If Edge Function returned from database (TPOS failed), it means post/comment was deleted
          if (result.source === 'database') {
            console.log(`[Realtime Hook] ⚠️ TPOS API unavailable - comments may have been deleted by Facebook/TPOS`);
            // Don't invalidate queries if data is stale
          } else {
            console.log(`[Realtime Hook] ✅ Successfully fetched from TPOS`);
            queryClient.invalidateQueries({ queryKey: ['facebook-comments', pageId, videoId] });
          }
        } else if (currentDbCount === expectedDbCount) {
          console.log(`[Realtime Hook] ✅ DB in sync: ${currentDbCount} = ${expectedDbCount}`);
        } else if (currentDbCount > expectedDbCount) {
          // DB has more than expected - this shouldn't happen, but if it does, adjust deleted count
          console.log(`[Realtime Hook] ⚠️ DB has MORE than expected: ${currentDbCount} > ${expectedDbCount}`);
          const excess = currentDbCount - tposCount;
          deletedCountRef.current = excess;
          console.log(`[Realtime Hook] Adjusted deletedCount to ${deletedCountRef.current}`);
        }
        
        // Always update lastKnownCountRef if not already updated
        if (lastKnownCountRef.current !== tposCount) {
          lastKnownCountRef.current = tposCount;
        }
      } catch (error) {
        console.error('[Realtime Hook] Error:', error);
      } finally {
        isCheckingNewCommentsRef.current = false;
      }
    };

    // Initial check
    if (lastKnownCountRef.current === 0) {
      lastKnownCountRef.current = selectedVideo.countComment || 0;
      deletedCountRef.current = 0;
    }
    
    checkForNewComments();
    
    // Check every 8 seconds when live
    const interval = setInterval(checkForNewComments, 8000);
    
    return () => clearInterval(interval);
  }, [videoId, selectedVideo, isAutoRefresh, pageId, queryClient]);

  // Fetch comments with infinite scroll
  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchComments,
    isLoading: commentsLoading,
    error: commentsError,
  } = useInfiniteQuery({
    queryKey: ['facebook-comments', pageId, videoId, selectedVideo?.statusLive],
    queryFn: async ({ pageParam }) => {
      if (!pageId || !videoId) return { data: [], paging: {} };
      
      console.log(`[useFacebookComments] Fetching comments for video ${videoId}, pageParam: ${pageParam}`);
      const startTime = Date.now();
      
      // ========== OFFLINE VIDEO: Only query DB, no Edge Function ==========
      if (selectedVideo && selectedVideo.statusLive !== 1) {
        console.log(`[useFacebookComments] Video OFFLINE - fetching from DB only`);
        
        const { data: cachedComments, error: dbError } = await supabase
          .from('facebook_comments_archive' as any)
          .select('*')
          .eq('facebook_post_id', videoId)
          .eq('is_deleted', false)
          .order('comment_created_time', { ascending: false })
          .limit(1000);
        
        if (dbError) {
          console.error('[useFacebookComments] DB error:', dbError);
          return { data: [], paging: {}, isOffline: true };
        }
        
        const formattedComments = cachedComments?.map((c: any) => ({
          id: c.facebook_comment_id,
          message: c.comment_message || '',
          from: {
            name: c.facebook_user_name || 'Unknown',
            id: c.facebook_user_id || '',
          },
          created_time: c.comment_created_time,
          like_count: c.like_count || 0,
        })) || [];
        
        const elapsed = Date.now() - startTime;
        console.log(`[useFacebookComments] Loaded ${formattedComments.length} offline comments in ${elapsed}ms`);
        
        setErrorCount(0);
        setHasError(false);
        
        return { 
          data: formattedComments, 
          paging: {},
          fromCache: true,
          isOffline: true 
        };
      }
      
      // ========== LIVE VIDEO: ALWAYS fetch from TPOS, NEVER use cache ==========
      console.log('[useFacebookComments] Video LIVE - fetching from TPOS API (no cache)');
      
      const order = 'reverse_chronological';
      
      let url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${videoId}&limit=500&order=${order}`;
      if (pageParam) {
        url += `&after=${pageParam}`;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${session?.access_token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const error = await response.json();
          console.error('[useFacebookComments] Fetch error:', error);
          setErrorCount(prev => prev + 1);
          setHasError(true);
          throw new Error(error.error || 'Failed to fetch comments');
        }

        const data = await response.json();
        const elapsed = Date.now() - startTime;
        
        // Check source of data
        if (data.source === 'database') {
          console.log(`[useFacebookComments] ⚠️ Fetched ${data.data?.length || 0} comments from DATABASE (TPOS unavailable) in ${elapsed}ms`);
        } else {
          console.log(`[useFacebookComments] ✅ Fetched ${data.data?.length || 0} comments from TPOS in ${elapsed}ms`);
        }
        
        setErrorCount(0);
        setHasError(false);
        
        return data;
      } catch (error) {
        console.error('[useFacebookComments] Exception in queryFn:', error);
        setErrorCount(prev => prev + 1);
        setHasError(true);
        throw error;
      }
    },
    getNextPageParam: (lastPage) => {
      // No pagination for offline videos or cached data
      if (lastPage.fromCache || lastPage.isOffline) return undefined;
      
      if (!lastPage.data || lastPage.data.length === 0) return undefined;
      const nextPageCursor = lastPage.paging?.cursors?.after || (lastPage.paging?.next ? new URL(lastPage.paging.next).searchParams.get('after') : null);
      if (!nextPageCursor) return undefined;
      return nextPageCursor;
    },
    initialPageParam: undefined,
    enabled: !!videoId && !!pageId,
    refetchInterval: false, // Disabled - using realtime check instead
    retry: (failureCount, error) => {
      console.log(`[useFacebookComments] Retry attempt ${failureCount} for error:`, error);
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const comments = useMemo(() => {
    const allComments = commentsData?.pages.flatMap(page => page.data) || [];
    const uniqueComments = new Map<string, FacebookComment>();
    allComments.forEach(comment => {
      uniqueComments.set(comment.id, comment);
    });
    return Array.from(uniqueComments.values());
  }, [commentsData]);

  // Cache orders data - merge from facebook_pending_orders and TPOS API
  const { data: ordersData = [] } = useQuery({
    queryKey: ["tpos-orders", videoId],
    queryFn: async () => {
      if (!videoId) return [];

      const { data: { session } } = await supabase.auth.getSession();

      // Fetch from facebook_pending_orders table
      const { data: pendingOrders } = await supabase
        .from('facebook_pending_orders')
        .select('*')
        .eq('facebook_post_id', videoId)
        .order('created_at', { ascending: false });

      // Fetch from TPOS API
      const ordersResponse = await fetch(`https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-facebook-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId: videoId, top: 200 }),
      });

      const tposOrders = ordersResponse.ok ? (await ordersResponse.json()).value || [] : [];

      // Merge orders: prioritize facebook_pending_orders
      const mergedOrdersMap = new Map<string, TPOSOrder>();

      // Add TPOS API orders first
      tposOrders.forEach((order: TPOSOrder) => {
        if (order.Facebook_CommentId) {
          mergedOrdersMap.set(order.Facebook_CommentId, order);
        }
      });

      // Override with pending orders that have TPOS order ID
      pendingOrders?.forEach((pending) => {
        if (pending.facebook_comment_id && pending.tpos_order_id) {
          // Convert pending order to TPOSOrder format
          const tposOrder: TPOSOrder = {
            Id: pending.tpos_order_id,
            Code: pending.code || '',
            SessionIndex: pending.session_index,
            Facebook_UserId: pending.facebook_user_id,
            Facebook_PostId: pending.facebook_post_id,
            Facebook_ASUserId: '',
            Facebook_CommentId: pending.facebook_comment_id,
            Facebook_UserName: pending.name,
            Telephone: pending.phone || '',
            Name: pending.name,
            Note: pending.comment || '',
            PartnerId: 0,
            PartnerName: '',
            PartnerStatus: '',
            PartnerStatusText: null,
            TotalAmount: 0,
            TotalQuantity: 0,
            DateCreated: pending.created_time || pending.created_at,
            StatusText: 'Đã tạo đơn',
          };
          mergedOrdersMap.set(pending.facebook_comment_id, tposOrder);
        }
      });

      return Array.from(mergedOrdersMap.values());
    },
    enabled: !!videoId,
    staleTime: 5 * 60 * 1000,
  });

  // Real-time subscription for facebook_pending_orders and facebook_comments_archive
  useEffect(() => {
    if (!videoId) return;

    const channel = supabase
      .channel(`facebook-realtime-${videoId}`)
      
      // Subscribe to pending orders changes
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facebook_pending_orders',
          filter: `facebook_post_id=eq.${videoId}`,
        },
        (payload) => {
          console.log('[Realtime] facebook_pending_orders change:', payload);
          queryClient.invalidateQueries({ queryKey: ['tpos-orders', videoId] });
          queryClient.invalidateQueries({ queryKey: ['facebook-comments', pageId, videoId] });
        }
      )
      
      // Subscribe to comment INSERT (new comments)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'facebook_comments_archive',
          filter: `facebook_post_id=eq.${videoId}`,
        },
        (payload) => {
          console.log('[Realtime] New comment inserted:', payload);
          queryClient.invalidateQueries({ 
            queryKey: ['facebook-comments', pageId, videoId] 
          });
        }
      )
      
      // Subscribe to comment UPDATE (e.g., is_deleted changes)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'facebook_comments_archive',
          filter: `facebook_post_id=eq.${videoId}`,
        },
        (payload) => {
          console.log('[Realtime] Comment updated:', payload);
          queryClient.invalidateQueries({ 
            queryKey: ['facebook-comments', pageId, videoId] 
          });
        }
      )
      
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [videoId, pageId, queryClient]);

  // Track new comments
  useEffect(() => {
    if (comments.length === 0) return;

    const currentIds = new Set(comments.map((c) => c.id));
    const newIds = new Set<string>();

    currentIds.forEach((id) => {
      if (!allCommentIdsRef.current.has(id)) {
        newIds.add(id);
        allCommentIdsRef.current.add(id);
      }
    });

    if (newIds.size > 0) {
      setNewCommentIds(newIds);
      setTimeout(() => setNewCommentIds(new Set()), 3000);
    }
  }, [comments]);

  return {
    comments,
    ordersData,
    selectedVideo,
    setSelectedVideo,
    newCommentIds,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetchComments,
    commentsLoading,
    hasError,
    errorCount,
  };
}
