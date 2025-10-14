import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OrderBillNotification } from './OrderBillNotification';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
}

type PendingOrder = {
  id: string;
  name: string | null;
  session_index: string | null;
  code: string | null;
  tpos_order_id: string | null;
  phone: string | null;
  comment: string | null;
  created_time: string;
  facebook_comment_id: string | null;
  facebook_user_id: string | null;
  facebook_post_id: string | null;
  order_count: number;
};

export function QuickAddOrder({ productId, phaseId, sessionId, availableQuantity }: QuickAddOrderProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch phase data to get the date
  const { data: phaseData } = useQuery({
    queryKey: ['live-phase', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_phases')
        .select('phase_date')
        .eq('id', phaseId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId,
  });

  // Fetch existing orders and count usage per comment
  const { data: existingOrders = [] } = useQuery({
    queryKey: ['live-orders', phaseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_orders')
        .select('order_code, facebook_comment_id')
        .eq('live_phase_id', phaseId);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId,
  });

  // Fetch facebook_pending_orders for the phase date (include order_count)
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['facebook-pending-orders', phaseData?.phase_date],
    queryFn: async () => {
      if (!phaseData?.phase_date) return [];
      
      const { data, error } = await supabase
        .from('facebook_pending_orders')
        .select('*, order_count')
        .gte('created_time', `${phaseData.phase_date}T00:00:00`)
        .lt('created_time', `${phaseData.phase_date}T23:59:59`)
        .order('created_time', { ascending: false });
      
      if (error) throw error;
      return (data || []) as PendingOrder[];
    },
    enabled: !!phaseData?.phase_date,
    refetchInterval: 5000,
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!phaseData?.phase_date) return;

    const channel = supabase
      .channel('facebook-pending-orders-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'facebook_pending_orders',
        },
        (payload) => {
          // Only refetch if the new order is for today's phase
          if (!payload.new || typeof payload.new !== 'object') return;
          const createdTime = new Date((payload.new as any).created_time);
          const phaseDate = new Date(phaseData.phase_date);
          
          if (
            createdTime.getDate() === phaseDate.getDate() &&
            createdTime.getMonth() === phaseDate.getMonth() &&
            createdTime.getFullYear() === phaseDate.getFullYear()
          ) {
            queryClient.invalidateQueries({ queryKey: ['facebook-pending-orders', phaseData.phase_date] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [phaseData?.phase_date, queryClient]);

  // Count how many times each comment has been used
  const commentUsageCount = React.useMemo(() => {
    const countMap = new Map<string, number>();
    existingOrders.forEach(order => {
      if (order.facebook_comment_id) {
        const current = countMap.get(order.facebook_comment_id) || 0;
        countMap.set(order.facebook_comment_id, current + 1);
      }
    });
    return countMap;
  }, [existingOrders]);

  // Flatten all comments with remaining > 0, sorted by created_time (newest first)
  const flatComments = React.useMemo(() => {
    const comments: {
      id: string;
      sessionIndex: string;
      name: string | null;
      comment: string | null;
      facebook_comment_id: string;
      created_time: string;
      remaining: number;
      total: number;
    }[] = [];

    pendingOrders.forEach((order) => {
      if (!order.session_index || !order.facebook_comment_id) return;

      const used = commentUsageCount.get(order.facebook_comment_id) || 0;
      const total = order.order_count || 1;
      const remaining = total - used;

      if (remaining <= 0) return; // skip consumed comments

      comments.push({
        id: order.id,
        sessionIndex: order.session_index,
        name: order.name,
        comment: order.comment,
        facebook_comment_id: order.facebook_comment_id,
        created_time: order.created_time,
        remaining,
        total,
      });
    });

    // Sort by created_time descending (newest first)
    comments.sort((a, b) => 
      new Date(b.created_time).getTime() - new Date(a.created_time).getTime()
    );

    return comments;
  }, [pendingOrders, commentUsageCount]);

  const addOrderMutation = useMutation({
    mutationFn: async ({ sessionIndex, commentId }: { sessionIndex: string; commentId: string }) => {
      // Get current product data to check if overselling
      const { data: product, error: fetchError } = await supabase
        .from('live_products')
        .select('sold_quantity, prepared_quantity, product_code, product_name')
        .eq('id', productId)
        .single();

      if (fetchError) throw fetchError;

      // Get pending order details for bill
      const pendingOrder = pendingOrders.find(order => order.facebook_comment_id === commentId);

      // Check if this order will be an oversell
      const newSoldQuantity = (product.sold_quantity || 0) + 1;
      const isOversell = newSoldQuantity > product.prepared_quantity;

      // Insert new order with oversell flag and comment ID
      const { error: orderError } = await supabase
        .from('live_orders')
        .insert({
          order_code: sessionIndex,
          facebook_comment_id: commentId,
          tpos_order_id: pendingOrder?.code || null,
          code_tpos_order_id: pendingOrder?.tpos_order_id || null,
          live_session_id: sessionId,
          live_phase_id: phaseId,
          live_product_id: productId,
          quantity: 1,
          is_oversell: isOversell
        });

      if (orderError) throw orderError;

      // Update sold quantity
      const { error: updateError } = await supabase
        .from('live_products')
        .update({ sold_quantity: newSoldQuantity })
        .eq('id', productId);

      if (updateError) throw updateError;
      
      return { 
        sessionIndex, 
        isOversell,
        billData: pendingOrder ? {
          sessionIndex,
          phone: pendingOrder.phone,
          customerName: pendingOrder.name,
          productCode: product.product_code,
          productName: product.product_name,
          comment: pendingOrder.comment,
          createdTime: pendingOrder.created_time,
        } : null
      };
    },
    onSuccess: ({ sessionIndex, isOversell, billData }) => {
      setInputValue('');
      // Force refetch all related queries immediately
      queryClient.invalidateQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['live-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['orders-with-products', phaseId] });
      queryClient.invalidateQueries({ queryKey: ['facebook-pending-orders', phaseData?.phase_date] });
      
      // Also refetch queries to ensure UI updates immediately
      queryClient.refetchQueries({ queryKey: ['live-orders', phaseId] });
      queryClient.refetchQueries({ queryKey: ['live-products', phaseId] });
      queryClient.refetchQueries({ queryKey: ['orders-with-products', phaseId] });
      queryClient.refetchQueries({ queryKey: ['facebook-pending-orders', phaseData?.phase_date] });
      
      // Print bill automatically
      if (billData) {
        const billHtml = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { 
                margin: 0; 
                padding: 20px; 
                font-family: Tahoma, sans-serif; 
              }
              .bill-container {
                display: flex;
                flex-direction: column;
                gap: 0;
                text-align: center;
                line-height: 2.0;
              }
              .session-name {
                font-size: 19.5pt;
                font-weight: bold;
                line-height: 2.0;
              }
              .phone {
                font-size: 8pt;
                font-weight: bold;
                line-height: 2.0;
              }
              .product {
                font-size: 10pt;
                font-weight: bold;
                line-height: 2.0;
              }
              .comment {
                font-size: 15pt;
                font-weight: bold;
                font-style: italic;
                color: #000;
                line-height: 2.0;
              }
              .time {
                font-size: 6pt;
                font-weight: bold;
                color: #000;
                line-height: 2.0;
              }
            </style>
          </head>
          <body>
            <div class="bill-container">
              <div class="session-name">#${billData.sessionIndex} - ${billData.customerName}</div>
              <div class="phone">${billData.phone || 'Chưa có SĐT'}</div>
              <div class="product">${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}</div>
              ${billData.comment ? `<div class="comment">${billData.comment}</div>` : ''}
              <div class="time">${new Date(billData.createdTime).toLocaleString('vi-VN', { 
                timeZone: 'Asia/Bangkok',
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}</div>
            </div>
          </body>
          </html>
        `;
        
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        if (printWindow) {
          printWindow.document.write(billHtml);
          printWindow.document.close();
          printWindow.focus();
          
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
      
      toast({
        title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: isOversell 
          ? `Đã thêm đơn ${sessionIndex} (vượt số lượng - đánh dấu đỏ)`
          : `Đã thêm đơn hàng ${sessionIndex}`,
        variant: isOversell ? "destructive" : "default",
      });
    },
    onError: (error) => {
      console.error('Error adding order:', error);
      toast({
        title: "Lỗi",
        description: "Không thể thêm đơn hàng. Vui lòng thử lại.",
        variant: "destructive",
      });
    },
  });

  const handleSelectComment = (sessionIndex: string, commentId: string) => {
    addOrderMutation.mutate({ sessionIndex, commentId });
    setIsOpen(false);
  };

  const handleAddOrder = () => {
    const trimmedValue = inputValue.trim();
    
    if (!trimmedValue) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã đơn hàng",
        variant: "destructive",
      });
      return;
    }

    // Find first comment matching sessionIndex
    const matchedComment = flatComments.find(c => c.sessionIndex === trimmedValue);
    if (!matchedComment) {
      toast({
        title: "Không tìm thấy",
        description: `Mã "${trimmedValue}" không có comment khả dụng hoặc đã dùng hết`,
        variant: "destructive",
      });
      return;
    }

    handleSelectComment(matchedComment.sessionIndex, matchedComment.facebook_comment_id);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAddOrder();
    }
  };

  const isOutOfStock = availableQuantity <= 0;
  
  return (
    <div className="w-full flex gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1 relative">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setIsOpen(true)}
              placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn..."}
              className={cn(
                "text-sm h-9",
                isOutOfStock && "border-red-500"
              )}
              disabled={addOrderMutation.isPending}
            />
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[520px] p-0 bg-popover z-50" 
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false} className="bg-popover">
            <CommandInput 
              placeholder="Tìm mã đơn hoặc tên..."
              value={inputValue}
              onValueChange={setInputValue}
              className="bg-background"
            />
            <CommandList className="bg-popover">
              <CommandEmpty>Không thấy mã phù hợp.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[280px]">
                  {flatComments
                    .filter(comment =>
                      !inputValue ||
                      comment.sessionIndex?.includes(inputValue) ||
                      (comment.name || '').toLowerCase().includes(inputValue.toLowerCase()) ||
                      (comment.comment || '').toLowerCase().includes(inputValue.toLowerCase())
                    )
                    .map(comment => (
                      <CommandItem
                        key={comment.id}
                        className="cursor-pointer flex items-center justify-between gap-2"
                        onSelect={() => handleSelectComment(comment.sessionIndex, comment.facebook_comment_id)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="font-medium shrink-0">#{comment.sessionIndex}</span>
                          <span className="shrink-0">-</span>
                          <span className="font-bold truncate">{comment.name || '(không tên)'}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                          <span>{new Date(comment.created_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                          <span className="rounded bg-muted px-2 py-0.5">
                            còn {comment.remaining}/{comment.total}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Button
        onClick={handleAddOrder}
        disabled={addOrderMutation.isPending || !inputValue.trim()}
        size="sm"
        className="h-9"
      >
        <Plus className="h-4 w-4" />
      </Button>
    </div>
  );
}