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

  // Dynamic refetch interval based on error rate
  const getRefetchInterval = useCallback(() => {
    if (!isAutoRefresh || selectedVideo?.statusLive !== 1) return false;
    
    // If we have errors, increase the interval exponentially
    if (errorCount > 0) {
      const interval = Math.min(8000 * Math.pow(2, errorCount), 60000); // Max 60s
      console.log(`[useFacebookComments] Error count: ${errorCount}, using interval: ${interval}ms`);
      return interval;
    }
    
    return 8000; // Default 8 seconds
  }, [isAutoRefresh, selectedVideo?.statusLive, errorCount]);

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
    queryKey: ['facebook-comments', pageId, videoId],
    queryFn: async ({ pageParam }) => {
      if (!pageId || !videoId) return { data: [], paging: {} };
      
      console.log(`[useFacebookComments] Fetching comments for video ${videoId}, pageParam: ${pageParam}`);
      const startTime = Date.now();
      
      // ========== NEW: Check database first (only on first page) ==========
      if (!pageParam) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const { data: cachedComments, error: dbError } = await supabase
          .from('facebook_comments_archive' as any)
          .select('*')
          .eq('facebook_post_id', videoId)
          .gte('comment_created_time', oneMonthAgo.toISOString())
          .order('comment_created_time', { ascending: false })
          .limit(500);
        
        if (!dbError && cachedComments && cachedComments.length > 0) {
          console.log(`[useFacebookComments] Using ${cachedComments.length} cached comments from DB`);
          
          const formattedComments = cachedComments.map((c: any) => ({
            id: c.facebook_comment_id,
            message: c.comment_message || '',
            from: {
              name: c.facebook_user_name || 'Unknown',
              id: c.facebook_user_id || '',
            },
            created_time: c.comment_created_time,
            like_count: c.like_count || 0,
          }));
          
          setErrorCount(0);
          setHasError(false);
          
          return { 
            data: formattedComments, 
            paging: {},
            fromCache: true 
          };
        }
      }
      // ========== END NEW ==========
      
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
        console.log(`[useFacebookComments] Fetched ${data.data?.length || 0} comments from TPOS in ${elapsed}ms`);
        
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
      // If from cache, no pagination
      if (lastPage.fromCache) return undefined;
      
      if (!lastPage.data || lastPage.data.length === 0) return undefined;
      const nextPageCursor = lastPage.paging?.cursors?.after || (lastPage.paging?.next ? new URL(lastPage.paging.next).searchParams.get('after') : null);
      if (!nextPageCursor) return undefined;
      return nextPageCursor;
    },
    initialPageParam: undefined,
    enabled: !!videoId && !!pageId,
    refetchInterval: getRefetchInterval(),
    retry: (failureCount, error) => {
      console.log(`[useFacebookComments] Retry attempt ${failureCount} for error:`, error);
      return failureCount < 3; // Retry up to 3 times
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff
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

  // Real-time subscription for facebook_pending_orders
  useEffect(() => {
    if (!videoId) return;

    const channel = supabase
      .channel('facebook-pending-orders-comments-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facebook_pending_orders',
          filter: `facebook_post_id=eq.${videoId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['tpos-orders', videoId] });
          queryClient.invalidateQueries({ queryKey: ['facebook-comments', pageId, videoId] });
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
