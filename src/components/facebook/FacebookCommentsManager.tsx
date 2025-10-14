import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Video, MessageCircle, Heart, RefreshCw, Pause, Play, Search, Loader2, Facebook, ChevronDown, Copy, Maximize, Minimize } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import type { FacebookVideo, FacebookComment, CommentWithStatus, TPOSOrder } from "@/types/facebook";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Helper: Debounce function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface FacebookCommentsManagerProps {
  onVideoSelected?: (pageId: string, videoId: string, video: FacebookVideo | null) => void;
}

export function FacebookCommentsManager({ onVideoSelected }: FacebookCommentsManagerProps = {}) {
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [pageId, setPageId] = useState(() => {
    return localStorage.getItem('liveProducts_commentsPageId') || "";
  });
  const [limit, setLimit] = useState("1");
  const [selectedVideo, setSelectedVideo] = useState<FacebookVideo | null>(() => {
    const saved = localStorage.getItem('liveProducts_selectedFacebookVideo');
    return saved ? JSON.parse(saved) : null;
  });

  // Persist pageId to localStorage
  useEffect(() => {
    localStorage.setItem('liveProducts_commentsPageId', pageId);
  }, [pageId]);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [newCommentIds, setNewCommentIds] = useState<Set<string>>(new Set());
  const [selectedOrderInfo, setSelectedOrderInfo] = useState<TPOSOrder | null>(null);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const allCommentIdsRef = useRef<Set<string>>(new Set());
  const { toast } = useToast();

  // New optimized states
  const [customerStatusMap, setCustomerStatusMap] = useState<Map<string, any>>(new Map());
  const [isLoadingCustomerStatus, setIsLoadingCustomerStatus] = useState(false);
  const fetchInProgress = useRef(false);
  const customerStatusMapRef = useRef<Map<string, any>>(new Map());

  const [showOnlyWithOrders, setShowOnlyWithOrders] = useState(false);
  const [hideNames, setHideNames] = useState<string[]>(["Nhi Judy House"]);

  // State for confirming duplicate order creation
  const [confirmDuplicateOrderCommentId, setConfirmDuplicateOrderCommentId] = useState<string | null>(null);
  
  // State for fullscreen mode on mobile
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingCommentIds, setPendingCommentIds] = useState<Set<string>>(new Set());
  
  // Refs for realtime checking
  const lastKnownCountRef = useRef<number>(0);
  const isCheckingNewCommentsRef = useRef(false);
  const deletedCountRef = useRef<number>(0); // Track deleted comments by TPOS

  // Fetch Facebook pages from database
  const { data: facebookPages } = useQuery({
    queryKey: ["facebook-pages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_pages")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  // Get selected page details based on current pageId
  const selectedPage = facebookPages?.find((p) => p.page_id === pageId);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Đã sao chép",
      description: "JSON đã được sao chép vào clipboard",
    });
  };

  const createOrderMutation = useMutation({
    mutationFn: async ({ comment, video }: { comment: FacebookComment; video: FacebookVideo }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("User not authenticated");

      const response = await fetch(
        `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/create-tpos-order-from-comment`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ comment, video }),
        }
      );

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(JSON.stringify(responseData));
      }

      return responseData;
    },
    onMutate: (variables) => {
      setPendingCommentIds(prev => new Set(prev).add(variables.comment.id));
    },
    onSuccess: (data) => {
      toast({
        title: "Tạo đơn hàng thành công!",
        description: `Đơn hàng ${data.response.Code} đã được tạo.`,
      });
    },
    onError: (error: any) => {
      let errorData;
      try {
        errorData = JSON.parse(error.message);
      } catch (e) {
        errorData = { error: error.message };
      }

      toast({
        title: "Lỗi tạo đơn hàng",
        description: errorData.error || "Có lỗi không xác định",
        variant: "destructive",
      });
    },
    onSettled: (data, error, variables) => {
      setPendingCommentIds(prev => {
        const next = new Set(prev);
        next.delete(variables.comment.id);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["tpos-orders", selectedVideo?.objectId] });
      queryClient.invalidateQueries({ queryKey: ['facebook-comments', pageId, selectedVideo?.objectId] });
    },
  });

  const handleCreateOrderClick = (comment: CommentWithStatus) => {
    // If comment already has order, show inline confirmation
    if (comment.orderInfo) {
      setConfirmDuplicateOrderCommentId(comment.id);
      return;
    }
    
    // Create order directly
    if (selectedVideo) {
      createOrderMutation.mutate({ comment, video: selectedVideo });
    }
  };

  const handleConfirmDuplicateOrder = (comment: CommentWithStatus) => {
    if (!selectedVideo) return;
    
    setConfirmDuplicateOrderCommentId(null);
    createOrderMutation.mutate({ comment, video: selectedVideo });
  };

  const handleCancelDuplicateOrder = () => {
    setConfirmDuplicateOrderCommentId(null);
  };

  // Fetch videos
  const { data: videos = [], isLoading: videosLoading, refetch: refetchVideos } = useQuery({
    queryKey: ['facebook-videos', pageId, limit],
    queryFn: async () => {
      if (!pageId) return [];
      
      const url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-livevideo?pageId=${pageId}&limit=${limit}`;
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch videos');
      }

      const result = await response.json();
      return (Array.isArray(result) ? result : result.data || []) as FacebookVideo[];
    },
    enabled: !!pageId,
  });

  // Fetch comments with infinite scroll
  const {
    data: commentsData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch: refetchComments,
    isLoading: commentsLoading,
  } = useInfiniteQuery({
    queryKey: ['facebook-comments', pageId, selectedVideo?.objectId],
    queryFn: async ({ pageParam }) => {
      if (!pageId || !selectedVideo?.objectId) return { data: [], paging: {} };
      
      console.log(`[FacebookCommentsManager] Fetching comments, pageParam: ${pageParam}`);
      const startTime = Date.now();
      
      // Check database first (only on first page)
      if (!pageParam) {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const { data: cachedComments, error: dbError } = await supabase
          .from('facebook_comments_archive' as any)
          .select('*')
          .eq('facebook_post_id', selectedVideo.objectId)
          .gte('comment_created_time', oneMonthAgo.toISOString())
          .order('comment_created_time', { ascending: false })
          .limit(1000);
        
        if (!dbError && cachedComments && cachedComments.length > 0) {
          const elapsed = Date.now() - startTime;
          console.log(`[FacebookCommentsManager] Using ${cachedComments.length} cached comments from DB (${elapsed}ms)`);
          
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
          
          return { 
            data: formattedComments, 
            paging: {},
            fromCache: true 
          };
        }
      }
      
      // Fetch from TPOS if not in cache
      const order = selectedVideo.statusLive === 1 ? 'reverse_chronological' : 'chronological';
      
      let url = `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&limit=500&order=${order}`;
      if (pageParam) {
        url += `&after=${pageParam}`;
      }
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch comments');
      }

      const data = await response.json();
      const elapsed = Date.now() - startTime;
      console.log(`[FacebookCommentsManager] Fetched ${data.data?.length || 0} comments from TPOS (${elapsed}ms)`);

      return data;
    },
    getNextPageParam: (lastPage) => {
      // If from cache, no pagination
      if (lastPage.fromCache) return undefined;
      
      if (!lastPage.data || lastPage.data.length === 0) {
        return undefined;
      }

      const nextPageCursor = lastPage.paging?.cursors?.after || (lastPage.paging?.next ? new URL(lastPage.paging.next).searchParams.get('after') : null);

      if (!nextPageCursor) {
        return undefined;
      }

      return nextPageCursor;
    },
    initialPageParam: undefined,
    enabled: !!selectedVideo && !!pageId,
    refetchInterval: false, // Disabled - using realtime check instead
  });
  
  // Realtime check for new comments (only when live)
  useEffect(() => {
    if (!selectedVideo || !pageId || !isAutoRefresh || selectedVideo.statusLive !== 1) {
      return;
    }

    const checkForNewComments = async () => {
      if (isCheckingNewCommentsRef.current) return;
      
      isCheckingNewCommentsRef.current = true;
      
      try {
        // 1. Count comments in DB
        const { count: dbCount } = await supabase
          .from('facebook_comments_archive' as any)
          .select('*', { count: 'exact', head: true })
          .eq('facebook_post_id', selectedVideo.objectId);
        
        const currentDbCount = dbCount || 0;
        const tposCount = selectedVideo.countComment || 0;
        
        console.log(`[Realtime Check] Video: ${selectedVideo.objectId}`);
        console.log(`  DB: ${currentDbCount}, TPOS: ${tposCount}, Deleted: ${deletedCountRef.current}, Last TPOS: ${lastKnownCountRef.current}`);
        
        // 2. Check if TPOS deleted comments
        if (lastKnownCountRef.current > 0 && tposCount < lastKnownCountRef.current) {
          const deletedThisTime = lastKnownCountRef.current - tposCount;
          deletedCountRef.current += deletedThisTime;
          
          console.log(`[Realtime Check] TPOS deleted ${deletedThisTime} comments (Total deleted: ${deletedCountRef.current})`);
          
          toast({
            title: "TPOS đã xóa comment",
            description: `${deletedThisTime} comment bị xóa (Tổng: ${deletedCountRef.current})`,
            variant: "destructive",
          });
        }
        
        // 3. Calculate expected DB count: TPOS count + deleted count
        const expectedDbCount = tposCount + deletedCountRef.current;
        
        console.log(`  Expected DB count: ${tposCount} + ${deletedCountRef.current} = ${expectedDbCount}`);
        
        // 4. If DB has fewer comments than expected → Fetch new comments
        if (currentDbCount < expectedDbCount) {
          const newCommentsCount = expectedDbCount - currentDbCount;
          console.log(`[Realtime Check] Need to fetch ${newCommentsCount} new comments`);
          
          const { data: { session } } = await supabase.auth.getSession();
          
          // Fetch only latest comments
          await fetch(
            `https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/facebook-comments?pageId=${pageId}&postId=${selectedVideo.objectId}&limit=100&order=reverse_chronological`,
            {
              headers: {
                'Authorization': `Bearer ${session?.access_token}`,
                'Content-Type': 'application/json',
              },
            }
          );
          
          // Invalidate to reload from DB
          queryClient.invalidateQueries({ queryKey: ['facebook-comments', pageId, selectedVideo.objectId] });
          
          toast({
            title: "Comment mới",
            description: `Có ${newCommentsCount} comment mới`,
          });
        } else if (currentDbCount === expectedDbCount) {
          console.log(`[Realtime Check] DB in sync: ${currentDbCount} = ${expectedDbCount}`);
        }
        
        // 5. Update last known TPOS count
        lastKnownCountRef.current = tposCount;
      } catch (error) {
        console.error('[Realtime Check] Error:', error);
      } finally {
        isCheckingNewCommentsRef.current = false;
      }
    };

    // Initial count
    if (lastKnownCountRef.current === 0) {
      lastKnownCountRef.current = selectedVideo.countComment || 0;
    }
    
    // Check every 10 seconds when live
    const interval = setInterval(checkForNewComments, 10000);
    
    return () => clearInterval(interval);
  }, [selectedVideo, pageId, isAutoRefresh, queryClient, toast]);

  const comments = useMemo(() => {
    const allComments = commentsData?.pages.flatMap(page => page.data) || [];
    const uniqueComments = new Map<string, FacebookComment>();
    allComments.forEach(comment => {
      uniqueComments.set(comment.id, comment);
    });
    return Array.from(uniqueComments.values());
  }, [commentsData]);

  // Cache orders data with React Query
  const { data: ordersData = [] } = useQuery({
    queryKey: ["tpos-orders", selectedVideo?.objectId],
    queryFn: async () => {
      if (!selectedVideo?.objectId) return [];

      const { data: { session } } = await supabase.auth.getSession();

      const ordersResponse = await fetch(`https://xneoovjmwhzzphwlwojc.supabase.co/functions/v1/fetch-facebook-orders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ postId: selectedVideo.objectId, top: 200 }),
      });

      if (!ordersResponse.ok) return [];

      const ordersDataResult = await ordersResponse.json();
      return ordersDataResult.value || [];
    },
    enabled: !!selectedVideo?.objectId,
    staleTime: 5 * 60 * 1000,
  });

  const mapStatusText = (statusText: string | null | undefined): string => {
    if (!statusText) return 'Bình thường';

    const normalizedStatus = statusText.trim().toLowerCase();

    const statusMap: Record<string, string> = {
      'normal': 'Bình thường',
      'bomb': 'Bom hàng',
      'warning': 'Cảnh báo',
      'wholesale': 'Khách sỉ',
      'danger': 'Nguy hiểm',
      'close': 'Thân thiết',
      'vip': 'VIP',
      'thieu thong tin': 'Thiếu thông tin',
      'incomplete': 'Cần thêm TT',
      'bình thường': 'Bình thường',
      'bom hàng': 'Bom hàng',
      'cảnh báo': 'Cảnh báo',
      'khách sỉ': 'Khách sỉ',
      'nguy hiểm': 'Nguy hiểm',
      'thân thiết': 'Thân thiết',
      'thiếu thông tin': 'Thiếu thông tin',
      'cần thêm tt': 'Cần thêm TT',
    };

    if (statusMap[normalizedStatus]) {
      return statusMap[normalizedStatus];
    }

    return 'Bình thường';
  };


  const fetchPartnerStatusBatch = useCallback(async (
    commentsToProcess: FacebookComment[], 
    orders: TPOSOrder[]
  ) => {
    if (fetchInProgress.current) return;
    if (commentsToProcess.length === 0) return;

    fetchInProgress.current = true;
    setIsLoadingCustomerStatus(true);

    try {
      // 1. Get unique Facebook user IDs from the comments that need processing.
      const facebookIdsToFetch = [
        ...new Set(
            commentsToProcess
                .map(c => c.from.id)
                .filter(id => id && !customerStatusMapRef.current.has(id))
        )
      ];
      
      if (facebookIdsToFetch.length === 0) {
        fetchInProgress.current = false;
        setIsLoadingCustomerStatus(false);
        return;
      }
      
      // 2. Create a map of Facebook User ID -> TPOS Order.
      const userOrderMap = new Map<string, TPOSOrder>();
      for (const order of orders) {
          if (order.Facebook_ASUserId && !userOrderMap.has(order.Facebook_ASUserId)) {
              userOrderMap.set(order.Facebook_ASUserId, order);
          }
      }

      // 3. Fetch existing customer records from our DB for these Facebook IDs.
      const { data: existingCustomers = [] } = await supabase
        .from('customers')
        .select('*')
        .in('facebook_id', facebookIdsToFetch);
      const existingCustomersMap = new Map(existingCustomers.map(c => [c.facebook_id, c]));

      // 4. Prepare a batch of customer data to upsert into our DB.
      const customersToUpsert: any[] = [];
      const newStatusMap = new Map(customerStatusMapRef.current);

      for (const facebookId of facebookIdsToFetch) {
        const order = userOrderMap.get(facebookId);
        const existingCustomer = existingCustomersMap.get(facebookId);
        const commentAuthorName = commentsToProcess.find(c => c.from.id === facebookId)?.from.name || 'Unknown';

        let partnerStatus: string;
        let customerDataForUpsert: any;

        if (order && order.Telephone) {
            // User has an order with a phone number in this video.
            partnerStatus = mapStatusText(existingCustomer?.customer_status || order.PartnerStatusText);
            customerDataForUpsert = {
                facebook_id: facebookId,
                customer_name: order.Name || commentAuthorName,
                phone: order.Telephone,
                customer_status: partnerStatus,
                info_status: 'complete',
            };
        } else if (existingCustomer) {
            // User exists in our DB but has no order in this video (or order has no phone).
            partnerStatus = mapStatusText(existingCustomer.customer_status);
            if (!existingCustomer.phone || existingCustomer.info_status === 'incomplete') {
                partnerStatus = 'Cần thêm TT';
            }
        } else {
            // New user, no order info in this video.
            partnerStatus = 'Khách lạ';
            customerDataForUpsert = {
                facebook_id: facebookId,
                customer_name: commentAuthorName,
                phone: null,
                customer_status: 'Bình thường',
                info_status: 'incomplete',
            };
        }

        if (customerDataForUpsert) {
            customersToUpsert.push(customerDataForUpsert);
        }

        // Update the local state map for the UI.
        newStatusMap.set(facebookId, {
            partnerStatus,
            orderInfo: order, // Associate the user's order with all their comments.
            isLoadingStatus: false,
        });
      }

      // 5. Upsert customer data to our DB.
      if (customersToUpsert.length > 0) {
        const { error: upsertError } = await supabase
            .from("customers")
            .upsert(customersToUpsert, { onConflict: "facebook_id", ignoreDuplicates: false });

        if (upsertError) {
          toast({
            title: "Lỗi khi lưu khách hàng",
            description: upsertError.message,
            variant: "destructive",
          });
        }
      }

      // 6. Update component state.
      customerStatusMapRef.current = newStatusMap;
      setCustomerStatusMap(newStatusMap);

    } catch (error) {
      toast({
        title: "Lỗi khi tải thông tin khách hàng",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      fetchInProgress.current = false;
      setIsLoadingCustomerStatus(false);
    }
  }, [toast, mapStatusText]);

  const debouncedFetchStatus = useMemo(
    () => debounce(fetchPartnerStatusBatch, 100),
    [fetchPartnerStatusBatch]
  );

  useEffect(() => {
    if (!comments.length || !ordersData.length) return;

    const commentsNeedingStatus = comments.filter(
      c => !customerStatusMapRef.current.has(c.from.id)
    );

    if (commentsNeedingStatus.length > 0) {
      debouncedFetchStatus(commentsNeedingStatus, ordersData);
    }
  }, [comments, ordersData, debouncedFetchStatus]);

  const commentsWithStatus = useMemo((): CommentWithStatus[] => {
    return comments.map((comment) => {
      const status = customerStatusMap.get(comment.from.id);
      
      return {
        ...comment,
        partnerStatus: status?.partnerStatus || "Khách lạ",
        orderInfo: status?.orderInfo,
        isLoadingStatus: status?.isLoadingStatus ?? false,
      };
    });
  }, [comments, customerStatusMap]);

  useEffect(() => {
    if (comments.length === 0) {
      allCommentIdsRef.current = new Set();
      return;
    }
    
    const currentIds = new Set(comments.map(c => c.id));
    const previousIds = allCommentIdsRef.current;
    
    const newIds = new Set<string>();
    currentIds.forEach(id => {
      if (!previousIds.has(id)) {
        newIds.add(id);
      }
    });
    
    if (newIds.size > 0 && previousIds.size > 0) {
      setNewCommentIds(newIds);
      toast({
        title: `🔔 ${newIds.size} comment mới!`,
      });
      
      if (newIds.size < 20 && scrollRef.current) {
        scrollRef.current.scrollTop = 0;
      }
      
      setTimeout(() => {
        setNewCommentIds(new Set());
      }, 3000);
    }
    
    allCommentIdsRef.current = currentIds;
  }, [comments, toast]);


  const handleLoadVideos = async () => {
    if (!pageId) {
      toast({
        title: "Vui lòng nhập Page ID",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await refetchVideos();
      toast({
        title: "Đã tải videos thành công!",
      });
    } catch (error: any) {
      toast({
        title: "Lỗi khi tải videos: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleVideoClick = (video: FacebookVideo) => {
    setSelectedVideo(video);
    localStorage.setItem('liveProducts_selectedFacebookVideo', JSON.stringify(video));
    localStorage.setItem('liveProducts_commentsVideoId', video.objectId);
    if (onVideoSelected) {
      onVideoSelected(pageId, video.objectId, video);
    }
    allCommentIdsRef.current = new Set();
    setNewCommentIds(new Set());
    setSearchQuery("");
    // Reset realtime check counters
    lastKnownCountRef.current = video.countComment || 0;
    deletedCountRef.current = 0; // Reset deleted count for new video
  };

  const handleShowInfo = (orderInfo: TPOSOrder | undefined) => {
    if (orderInfo) {
      setSelectedOrderInfo(orderInfo);
      setIsInfoDialogOpen(true);
    } else {
      toast({
        title: "Chưa có thông tin đơn hàng",
        variant: "destructive",
      });
    }
  };

  const filteredComments = useMemo(() => {
    return commentsWithStatus.filter(comment => {
      const matchesSearch = !searchQuery ||
        comment.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        comment.from?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesOrderFilter = !showOnlyWithOrders || (comment.orderInfo && comment.orderInfo.Code);
      const notHidden = !hideNames.includes(comment.from?.name || '');

      return matchesSearch && matchesOrderFilter && notHidden;
    });
  }, [commentsWithStatus, searchQuery, showOnlyWithOrders, hideNames]);

  const stats = {
    totalVideos: videos.length,
    liveVideos: videos.filter(v => v.statusLive === 1).length,
    totalComments: videos.reduce((sum, v) => sum + (v.countComment || 0), 0),
    totalReactions: videos.reduce((sum, v) => sum + (v.countReaction || 0), 0),
  };

  const allCommentsLoaded = useMemo(() => {
    if (!selectedVideo || selectedVideo.statusLive === 1) return false;
    return commentsWithStatus.length >= selectedVideo.countComment;
  }, [commentsWithStatus, selectedVideo]);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={cn("flex-1 overflow-auto", isMobile ? "p-2" : "p-4")}>
        <div className="space-y-4">
          {/* Video List - now full width */}
          {!selectedVideo && (
          <Card className="border-0 shadow-sm">
          <CardHeader className={isMobile ? "pb-2" : "pb-3"}>
            <CardTitle className={isMobile ? "text-sm" : "text-base"}>
              Cấu hình và Videos
            </CardTitle>
            <CardDescription className={isMobile ? "text-xs" : "text-sm"}>
              Chọn Facebook Page từ danh sách đã thêm ở trên
            </CardDescription>
          </CardHeader>
            <CardContent className={cn("space-y-4", isMobile && "space-y-3")}>
              {selectedPage && selectedPage.crm_team_id && (
                <div className={cn(
                  "p-3 bg-muted rounded-md space-y-1",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  <div><span className="font-medium">Page:</span> {selectedPage.page_name}</div>
                  <div><span className="font-medium">CRM Team:</span> {selectedPage.crm_team_name} ({selectedPage.crm_team_id})</div>
                </div>
              )}
              <div className={cn(
                "flex gap-4",
                isMobile && "flex-col gap-2"
              )}>
                <div className="flex-1">
                  <Select value={pageId} onValueChange={setPageId}>
                    <SelectTrigger className={isMobile ? "h-9 text-xs" : ""}>
                      <SelectValue placeholder="Chọn fanpage" />
                    </SelectTrigger>
                    <SelectContent>
                      {facebookPages && facebookPages.length > 0 ? (
                        facebookPages.map((page) => (
                          <SelectItem key={page.id} value={page.page_id}>
                            {page.page_name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          Chưa có page nào. Thêm ở tab trên.
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className={cn(isMobile ? "w-full" : "w-32")}>
                  <Input
                    type="number"
                    placeholder="Limit"
                    value={limit}
                    onChange={(e) => setLimit(e.target.value)}
                    min="1"
                    max="50"
                    className={isMobile ? "h-9 text-xs" : ""}
                  />
                </div>
                <Button 
                  onClick={handleLoadVideos} 
                  disabled={videosLoading}
                  size={isMobile ? "sm" : "default"}
                  className={isMobile ? "w-full" : ""}
                >
                  {videosLoading ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Tải Videos
                    </>
                  )}
                </Button>
              </div>

              {videos.length > 0 && (
                <div className={cn(
                  "grid gap-4",
                  isMobile ? "grid-cols-2 gap-2" : "grid-cols-2 md:grid-cols-4"
                )}>
                  <Card>
                    <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                      <div className="text-center">
                        <Video className={cn(
                          "mx-auto mb-2 text-primary",
                          isMobile ? "h-6 w-6" : "h-8 w-8"
                        )} />
                        <div className={cn(
                          "font-bold",
                          isMobile ? "text-lg" : "text-2xl"
                        )}>
                          {stats.totalVideos}
                        </div>
                        <div className={cn(
                          "text-muted-foreground",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Videos
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                      <div className="text-center">
                        <Badge 
                          variant="destructive" 
                          className={cn("mb-2", isMobile && "text-xs")}
                        >
                          LIVE
                        </Badge>
                        <div className={cn(
                          "font-bold",
                          isMobile ? "text-lg" : "text-2xl"
                        )}>
                          {stats.liveVideos}
                        </div>
                        <div className={cn(
                          "text-muted-foreground",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Đang Live
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                      <div className="text-center">
                        <MessageCircle className={cn(
                          "mx-auto mb-2 text-blue-500",
                          isMobile ? "h-6 w-6" : "h-8 w-8"
                        )} />
                        <div className={cn(
                          "font-bold",
                          isMobile ? "text-lg" : "text-2xl"
                        )}>
                          {(stats.totalComments || 0).toLocaleString()}
                        </div>
                        <div className={cn(
                          "text-muted-foreground",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Comments
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className={isMobile ? "pt-4" : "pt-6"}>
                      <div className="text-center">
                        <Heart className={cn(
                          "mx-auto mb-2 text-red-500",
                          isMobile ? "h-6 w-6" : "h-8 w-8"
                        )} />
                        <div className={cn(
                          "font-bold",
                          isMobile ? "text-lg" : "text-2xl"
                        )}>
                          {(stats.totalReactions || 0).toLocaleString()}
                        </div>
                        <div className={cn(
                          "text-muted-foreground",
                          isMobile ? "text-xs" : "text-sm"
                        )}>
                          Reactions
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
          )}

          {videos.length > 0 && !selectedVideo && (
            <ScrollArea className="h-[600px]">
              <div className="space-y-4 pr-4">
                {videos.map((video) => (
                  <Card
                    key={video.objectId}
                    className={`cursor-pointer hover:shadow-lg transition-all overflow-hidden ${
                      selectedVideo?.objectId === video.objectId ? 'border-primary border-2' : ''
                    }`}
                    onClick={() => handleVideoClick(video)}
                  >
                    <div className="relative aspect-video bg-muted">
                      {video.thumbnail?.url ? (
                        <img
                          src={video.thumbnail.url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="h-12 w-12 text-muted-foreground opacity-30" />
                        </div>
                      )}
                      {video.statusLive === 1 && (
                        <Badge variant="destructive" className="absolute top-2 right-2">
                          🔴 LIVE
                        </Badge>
                      )}
                    </div>
                    
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base line-clamp-2">
                        {video.title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {video.channelCreatedTime ? format(new Date(video.channelCreatedTime), 'dd/MM/yyyy HH:mm') : 'N/A'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4" />
                          <span>{(video.countComment || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Heart className="h-4 w-4" />
                          <span>{(video.countReaction || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Comments Panel - now full width */}
          {selectedVideo ? (
          <Card className={cn(
            "border-0 shadow-sm transition-all duration-300",
            isMobile && isFullscreen && "fixed inset-0 z-50 rounded-none m-0"
          )}>
            <CardHeader className={cn(
              "border-b",
              isMobile ? "py-2" : "py-3"
            )}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <CardTitle className={cn(
                    "line-clamp-1",
                    isMobile ? "text-sm" : "text-base"
                  )}>
                    {selectedVideo.title}
                  </CardTitle>
                  <CardDescription className={isMobile ? "text-xs" : "text-sm"}>
                    Xem và theo dõi comments từ video
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {selectedVideo.statusLive === 1 && (
                    <Badge variant="destructive" className={isMobile ? "text-xs" : ""}>
                      🔴 LIVE
                    </Badge>
                  )}
                  
                  {/* Fullscreen button for mobile */}
                  {isMobile && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="h-7 px-2"
                    >
                      {isFullscreen ? (
                        <Minimize className="h-3.5 w-3.5" />
                      ) : (
                        <Maximize className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  )}
                  
                  {/* Select another video button */}
                  <Button
                    variant="outline"
                    size={isMobile ? "sm" : "default"}
                    onClick={() => {
                      setSelectedVideo(null);
                      setIsFullscreen(false);
                    }}
                    className={isMobile ? "text-xs h-7 px-2" : ""}
                  >
                    <Video className={cn(isMobile ? "h-3 w-3" : "h-4 w-4 mr-2")} />
                    {!isMobile && "Chọn video khác"}
                  </Button>
                </div>
              </div>
            </CardHeader>
              
              <CardContent className="pt-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                  >
                    {isAutoRefresh ? (
                      <>
                        <Pause className="mr-2 h-4 w-4" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="mr-2 h-4 w-4" />
                        Resume
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      queryClient.removeQueries({ queryKey: ['facebook-comments', pageId, selectedVideo?.objectId] });
                      refetchComments();
                      toast({
                        title: "Đang làm mới",
                        description: "Đang tải lại comments từ TPOS...",
                      });
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Làm mới từ TPOS
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => refetchComments()}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh
                  </Button>
                  {newCommentIds.size > 0 && (
                    <Badge variant="default" className="ml-auto">
                      {newCommentIds.size} mới
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Tìm kiếm comments..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center space-x-2">
                      <Checkbox id="show-only-with-orders" checked={showOnlyWithOrders} onCheckedChange={(checked) => setShowOnlyWithOrders(checked as boolean)} />
                      <Label htmlFor="show-only-with-orders" className="text-sm font-medium whitespace-nowrap">
                        Chỉ hiển thị comment có đơn
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox 
                        id="hide-page-comments" 
                        checked={hideNames.includes("Nhi Judy House")} 
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setHideNames(["Nhi Judy House"]);
                          } else {
                            setHideNames([]);
                          }
                        }} 
                      />
                      <Label htmlFor="hide-page-comments" className="text-sm font-medium whitespace-nowrap">
                        Ẩn "Nhi Judy House"
                      </Label>
                    </div>
                    <div className="text-sm text-muted-foreground ml-auto">
                      Hiển thị {filteredComments.length} / {commentsWithStatus.length} comments
                    </div>
                  </div>
                </div>

                <ScrollArea 
                  className={cn(
                    isMobile && isFullscreen 
                      ? "h-[calc(100vh-180px)]"
                      : "h-[500px]",
                    "pr-4"
                  )} 
                  ref={scrollRef}
                >
                  <div className="space-y-4">
                    {commentsLoading && comments.length === 0 ? (
                      <div className="text-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                      </div>
                    ) : filteredComments.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        {searchQuery ? "Không tìm thấy comment nào" : "Chưa có comment"}
                      </div>
                    ) : (
                      filteredComments.map((comment) => {
                        const isNew = newCommentIds.has(comment.id);
                        const status = comment.partnerStatus || 'Khách lạ';
                        const isWarning = status.toLowerCase().includes('cảnh báo') || status.toLowerCase().includes('warning');
                        
                        return (
                          <Card
                            key={comment.id}
                            className={isNew ? "border-primary bg-primary/5 animate-in fade-in slide-in-from-bottom-2" : ""}
                          >
                            <CardContent className="pt-4">
                              <div className="flex items-start gap-3">
                                <div className="relative flex-shrink-0">
                                  <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm",
                                    comment.orderInfo?.SessionIndex 
                                      ? "bg-red-500" 
                                      : "bg-gradient-to-br from-primary to-primary/60"
                                  )}>
                                    {comment.orderInfo?.SessionIndex 
                                      ? comment.orderInfo.SessionIndex 
                                      : comment.from?.name?.charAt(0) || '?'}
                                  </div>
                                </div>
                                  <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Badge variant="default" className="text-xs font-semibold">{comment.from?.name}</Badge>
                                    {comment.partnerStatus && comment.partnerStatus !== 'Khách lạ' && comment.partnerStatus !== 'Cần thêm TT' && (
                                      <Badge 
                                        variant={
                                          comment.partnerStatus === 'Cảnh báo' ? 'secondary' :
                                          comment.partnerStatus === 'Bom hàng' || comment.partnerStatus === 'Nguy hiểm' ? 'destructive' :
                                          'default'
                                        }
                                        className={cn(
                                          "text-xs",
                                          comment.partnerStatus === 'Bình thường' && "bg-green-400 hover:bg-green-400 text-white"
                                        )}
                                      >
                                        {comment.partnerStatus}
                                      </Badge>
                                    )}
                                    {!isMobile && comment.orderInfo?.Telephone ? (
                                      <Badge variant="outline" className="text-xs">
                                        {comment.orderInfo.Telephone}
                                      </Badge>
                                    ) : !comment.orderInfo?.Telephone && comment.partnerStatus === 'Cần thêm TT' ? (
                                      <Badge variant="secondary" className="text-xs bg-red-500/20 text-red-700">
                                        Cần thêm TT
                                      </Badge>
                                    ) : !comment.orderInfo?.Telephone ? (
                                      <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-700">
                                        Chưa có TT
                                      </Badge>
                                    ) : null}
                                    {isNew && (
                                      <Badge variant="default" className="text-xs">✨ MỚI</Badge>
                                    )}
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {comment.created_time ? format(new Date(comment.created_time), isMobile ? 'HH:mm' : 'dd/MM/yyyy HH:mm') : 'N/A'}
                                    </span>
                                  </div>
                                  
                                  <p className="text-sm font-semibold whitespace-pre-wrap break-words mt-1.5">
                                    {comment.message}
                                  </p>
                                  
                                  {/* Inline confirmation for duplicate order */}
                                  {confirmDuplicateOrderCommentId === comment.id && (
                                    <div className="mb-3 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-md">
                                      <p className="text-sm text-orange-800 dark:text-orange-200 mb-2">
                                        ⚠️ Bình luận này đã có đơn hàng. Tạo thêm đơn mới?
                                      </p>
                                      <div className="flex gap-2">
                                        <Button 
                                          size="sm" 
                                          variant="default"
                                          className="h-7 text-xs"
                                          onClick={() => handleConfirmDuplicateOrder(comment)}
                                        >
                                          Tạo đơn mới
                                        </Button>
                                        <Button 
                                          size="sm" 
                                          variant="outline"
                                          className="h-7 text-xs"
                                          onClick={handleCancelDuplicateOrder}
                                        >
                                          Hủy
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  
                                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                                    <Button 
                                      size="sm" 
                                      className="h-7 text-xs"
                                      onClick={() => handleCreateOrderClick(comment)}
                                      disabled={pendingCommentIds.has(comment.id)}
                                    >
                                      {pendingCommentIds.has(comment.id) && (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      )}
                                      Tạo đơn hàng
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-7 text-xs"
                                      onClick={() => handleShowInfo(comment.orderInfo)}
                                    >
                                      Thông tin
                                    </Button>
                                    {comment.like_count > 0 && (
                                      <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                                        <Heart className="h-3 w-3" />
                                        {comment.like_count}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                    {allCommentsLoaded ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        Đã tải tất cả bình luận.
                      </div>
                    ) : hasNextPage && (
                      <div className="text-center py-4">
                        <Button
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                          variant="outline"
                        >
                          {isFetchingNextPage ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Tải thêm bình luận
                        </Button>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <div className="text-sm text-muted-foreground text-center pt-2 border-t">
                  {selectedVideo && selectedVideo.statusLive !== 1
                    ? `Hiển thị ${filteredComments.length} / ${commentsWithStatus.length} comments (Tổng: ${selectedVideo.countComment})`
                    : `Hiển thị ${filteredComments.length} / ${commentsWithStatus.length} comments`
                  }
                  {isAutoRefresh && " • Auto-refresh mỗi 10s"}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className={cn(
                "flex flex-col items-center justify-center",
                isMobile ? "py-8" : "py-12"
              )}>
                <MessageCircle className={cn(
                  "text-muted-foreground/30 mb-4",
                  isMobile ? "h-12 w-12" : "h-16 w-16"
                )} />
                <p className={cn(
                  "font-medium text-muted-foreground",
                  isMobile ? "text-base" : "text-lg"
                )}>
                  Chọn video để xem comments
                </p>
                <p className={cn(
                  "text-muted-foreground/70 mt-2",
                  isMobile ? "text-xs" : "text-sm"
                )}>
                  {videos.length > 0 
                    ? `${videos.length} video có sẵn - Click để xem comment` 
                    : "Tải videos từ Facebook page ở trên"}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Order Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thông tin đơn hàng</DialogTitle>
            <DialogDescription>
              Chi tiết đơn hàng từ TPOS
            </DialogDescription>
          </DialogHeader>

          {selectedOrderInfo && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Mã đơn</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Code}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Trạng thái</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.StatusText}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Khách hàng</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Số điện thoại</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Telephone}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Partner</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.PartnerName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Partner Status</label>
                  <Badge variant={selectedOrderInfo.PartnerStatus === 'Normal' ? 'default' : 'destructive'}>
                    {selectedOrderInfo.PartnerStatusText || selectedOrderInfo.PartnerStatus}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium">Tổng tiền</label>
                  <p className="text-sm text-muted-foreground">
                    {(selectedOrderInfo.TotalAmount || 0).toLocaleString('vi-VN')} đ
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Số lượng</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.TotalQuantity}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Ghi chú</label>
                  <p className="text-sm text-muted-foreground">{selectedOrderInfo.Note || 'Không có'}</p>
                </div>
                <div className="col-span-2">
                  <label className="text-sm font-medium">Ngày tạo</label>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrderInfo.DateCreated ? format(new Date(selectedOrderInfo.DateCreated), 'dd/MM/yyyy HH:mm:ss') : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
}