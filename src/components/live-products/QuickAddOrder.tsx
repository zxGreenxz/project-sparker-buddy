import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { OrderBillNotification } from './OrderBillNotification';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { getActivePrinter } from '@/lib/printer-utils';
import { textToESCPOSBitmap } from '@/lib/text-to-bitmap';
interface QuickAddOrderProps {
  productId: string;
  phaseId: string;
  sessionId?: string;
  availableQuantity: number;
  onOrderAdded?: (quantity: number) => void;
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
export function QuickAddOrder({
  productId,
  phaseId,
  sessionId,
  availableQuantity,
  onOrderAdded
}: QuickAddOrderProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();

  // State for hiding comments (client-side only, persisted in localStorage)
  const [hiddenCommentIds, setHiddenCommentIds] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('quickAddOrder_hiddenComments');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Persist hidden comments to localStorage
  useEffect(() => {
    localStorage.setItem('quickAddOrder_hiddenComments', JSON.stringify([...hiddenCommentIds]));
  }, [hiddenCommentIds]);

  // Fetch phase data to get the date
  const {
    data: phaseData
  } = useQuery({
    queryKey: ['live-phase', phaseId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('live_phases').select('phase_date').eq('id', phaseId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!phaseId
  });

  // Fetch existing orders and count usage per comment
  const {
    data: existingOrders = []
  } = useQuery({
    queryKey: ['live-orders', phaseId],
    queryFn: async () => {
      const {
        data,
        error
      } = await supabase.from('live_orders').select('order_code, facebook_comment_id').eq('live_phase_id', phaseId);
      if (error) throw error;
      return data || [];
    },
    enabled: !!phaseId
  });

  // Fetch facebook_pending_orders for the phase date (include order_count)
  const {
    data: pendingOrders = []
  } = useQuery({
    queryKey: ['facebook-pending-orders', phaseData?.phase_date],
    queryFn: async () => {
      if (!phaseData?.phase_date) return [];
      const {
        data,
        error
      } = await supabase.from('facebook_pending_orders').select('*, order_count').gte('created_time', `${phaseData.phase_date}T00:00:00`).lt('created_time', `${phaseData.phase_date}T23:59:59`).order('created_time', {
        ascending: false
      });
      if (error) throw error;
      return (data || []) as PendingOrder[];
    },
    enabled: !!phaseData?.phase_date,
    refetchInterval: 5000
  });

  // Real-time subscription for instant updates
  useEffect(() => {
    if (!phaseData?.phase_date) return;
    const channel = supabase.channel('facebook-pending-orders-realtime').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'facebook_pending_orders'
    }, payload => {
      // Only refetch if the new order is for today's phase
      if (!payload.new || typeof payload.new !== 'object') return;
      const createdTime = new Date((payload.new as any).created_time);
      const phaseDate = new Date(phaseData.phase_date);
      if (createdTime.getDate() === phaseDate.getDate() && createdTime.getMonth() === phaseDate.getMonth() && createdTime.getFullYear() === phaseDate.getFullYear()) {
        queryClient.invalidateQueries({
          queryKey: ['facebook-pending-orders', phaseData.phase_date]
        });
      }
    }).subscribe();
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
    pendingOrders.forEach(order => {
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
        total
      });
    });

    // Sort by created_time descending (newest first)
    comments.sort((a, b) => new Date(b.created_time).getTime() - new Date(a.created_time).getTime());

    // Filter out hidden comments (client-side only)
    return comments.filter(c => !hiddenCommentIds.has(c.facebook_comment_id));
  }, [pendingOrders, commentUsageCount, hiddenCommentIds]);
  const addOrderMutation = useMutation({
    mutationFn: async ({
      sessionIndex,
      commentId
    }: {
      sessionIndex: string;
      commentId: string;
    }) => {
      // Get current product data to check if overselling
      const {
        data: product,
        error: fetchError
      } = await supabase.from('live_products').select('sold_quantity, prepared_quantity, product_code, product_name').eq('id', productId).single();
      if (fetchError) throw fetchError;

      // Get pending order details for bill
      const pendingOrder = pendingOrders.find(order => order.facebook_comment_id === commentId);

      // Check if this order will be an oversell
      const newSoldQuantity = (product.sold_quantity || 0) + 1;
      const isOversell = newSoldQuantity > product.prepared_quantity;

      // Insert new order with oversell flag and comment ID
      const {
        error: orderError
      } = await supabase.from('live_orders').insert({
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
      const {
        error: updateError
      } = await supabase.from('live_products').update({
        sold_quantity: newSoldQuantity
      }).eq('id', productId);
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
          createdTime: pendingOrder.created_time
        } : null
      };
    },
    onSuccess: async ({
      sessionIndex,
      isOversell,
      billData
    }) => {
      setInputValue('');
      
      // Notify parent component to increment order quantity
      onOrderAdded?.(1);
      
      // Force refetch all related queries immediately
      queryClient.invalidateQueries({
        queryKey: ['live-orders', phaseId]
      });
      queryClient.invalidateQueries({
        queryKey: ['live-products', phaseId]
      });
      queryClient.invalidateQueries({
        queryKey: ['orders-with-products', phaseId]
      });
      queryClient.invalidateQueries({
        queryKey: ['facebook-pending-orders', phaseData?.phase_date]
      });

      // Also refetch queries to ensure UI updates immediately
      queryClient.refetchQueries({
        queryKey: ['live-orders', phaseId]
      });
      queryClient.refetchQueries({
        queryKey: ['live-products', phaseId]
      });
      queryClient.refetchQueries({
        queryKey: ['orders-with-products', phaseId]
      });
      queryClient.refetchQueries({
        queryKey: ['facebook-pending-orders', phaseData?.phase_date]
      });

      // Auto-print bill
      if (billData) {
        const activePrinter = getActivePrinter();
        if (activePrinter) {
          // Print to XC80 thermal printer using bitmap mode
          try {
            console.log(`🖨️ Converting text to bitmap for ${activePrinter.name} (${activePrinter.ipAddress}:${activePrinter.port})`);
            
            // Prepare lines with individual font sizes optimized for 576px width
            const printLines = [
              { text: `#${billData.sessionIndex} - ${billData.phone || 'Chưa có SĐT'}`, fontSize: 64, bold: true },  // Line 1: 2x
              { text: billData.customerName, fontSize: 64, bold: true },  // Line 2: 2x
              { text: `${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}`, fontSize: 24, bold: true },  // Line 3: 0.7x
              ...(billData.comment ? [{ text: billData.comment, fontSize: 64, bold: true }] : []),  // Line 4: 2x (if exists)
              { text: new Date(billData.createdTime).toLocaleString('vi-VN', {
                timeZone: 'Asia/Bangkok',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              }), fontSize: 32, bold: true }  // Line 5: keep original
            ];
            
            // Convert text to ESC/POS bitmap (includes paper cut)
            const bitmapData = await textToESCPOSBitmap('', {
              width: 576,  // Standard width for 80mm thermal printer
              fontFamily: 'Arial, sans-serif',
              lineHeight: 1.2,
              align: 'center',
              padding: 5,  // Small padding for header/footer
              lines: printLines,
              lineSpacing: 18  // Increased spacing between lines
            });
            
            // Convert to base64 for transmission
            const base64Bitmap = btoa(String.fromCharCode(...bitmapData));
            
            // Send to printer via bridge (use correct parameter names)
            const bridgeUrl = activePrinter.bridgeUrl || `http://${activePrinter.ipAddress}:${activePrinter.port}`;
            console.log(`🖨️ Sending bitmap to printer bridge: ${bridgeUrl}/print/bitmap`);
            
            const response = await fetch(`${bridgeUrl}/print/bitmap`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ipAddress: activePrinter.ipAddress,
                port: activePrinter.port,
                bitmapBase64: base64Bitmap,
                feeds: 3
              })
            });
            
            if (!response.ok) {
              throw new Error(`Bridge returned status ${response.status}`);
            }
            
            console.log("✅ Bill printed successfully (bitmap mode)");
          } catch (error) {
            console.error("Print failed:", error);
            toast({
              title: "⚠️ Lỗi in bill",
              description: `Không thể in lên ${activePrinter.name}. Lỗi: ${error instanceof Error ? error.message : 'Unknown error'}`,
              variant: "destructive"
            });
          }
        } else {
          // Fallback: Browser print dialog nếu không có máy in active
          console.log("⚠️ No active printer found, using browser dialog");
          const billHtml = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                @page {
                  margin: 2mm;
                }
                body { 
                  margin: 0; 
                  padding: 2mm; 
                  font-family: Tahoma, sans-serif;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  min-height: 100vh;
                }
                .bill-container {
                  display: flex;
                  flex-direction: column;
                  gap: 2mm;
                  text-align: center;
                  width: 100%;
                }
                .line1 {
                  font-size: 28pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
                .line1 .phone {
                  font-size: 18pt;
                  font-weight: bold;
                }
                .line2 {
                  font-size: 28pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
                .line3 {
                  font-size: 14pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
                .line4 {
                  font-size: 28pt;
                  font-weight: bold;
                  font-style: italic;
                  line-height: 1.2;
                }
                .line5 {
                  font-size: 7pt;
                  font-weight: bold;
                  line-height: 1.2;
                }
              </style>
            </head>
            <body>
              <div class="bill-container">
                <div class="line1">#${billData.sessionIndex} - <span class="phone">${billData.phone || 'Chưa có SĐT'}</span></div>
                <div class="line2">${billData.customerName}</div>
                <div class="line3">${billData.productCode} - ${billData.productName.replace(/^\d+\s+/, '')}</div>
                ${billData.comment ? `<div class="line4">${billData.comment}</div>` : ''}
                <div class="line5">${new Date(billData.createdTime).toLocaleString('vi-VN', {
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
      }
      toast({
        title: isOversell ? "⚠️ Đơn oversell" : "Thành công",
        description: isOversell ? `Đã thêm đơn ${sessionIndex} (vượt số lượng - đánh dấu đỏ)` : `Đã thêm đơn hàng ${sessionIndex}`,
        variant: isOversell ? "destructive" : "default"
      });
    },
    onError: error => {
      console.error('Error adding order:', error);
      toast({
        title: "Lỗi",
        description: "Không thể thêm đơn hàng. Vui lòng thử lại.",
        variant: "destructive"
      });
    }
  });
  const handleHideComment = (e: React.MouseEvent, commentId: string) => {
    e.stopPropagation();
    setHiddenCommentIds(prev => {
      const next = new Set(prev);
      next.add(commentId);
      return next;
    });
    toast({
      title: "Đã ẩn comment",
      description: "Comment đã được ẩn khỏi danh sách (dữ liệu vẫn còn nguyên)"
    });
  };
  const handleSelectComment = (sessionIndex: string, commentId: string) => {
    addOrderMutation.mutate({
      sessionIndex,
      commentId
    });
    setIsOpen(false);
  };
  const handleAddOrder = () => {
    const trimmedValue = inputValue.trim();
    if (!trimmedValue) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập mã đơn hàng",
        variant: "destructive"
      });
      return;
    }

    // Find first comment matching sessionIndex
    const matchedComment = flatComments.find(c => c.sessionIndex === trimmedValue);
    if (!matchedComment) {
      toast({
        title: "Không tìm thấy",
        description: `Mã "${trimmedValue}" không có comment khả dụng hoặc đã dùng hết`,
        variant: "destructive"
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
  return <div className="w-full flex gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <div className="flex-1 relative">
            <Input type="text" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyPress={handleKeyPress} onClick={() => setIsOpen(true)} placeholder={isOutOfStock ? "Quá số (đánh dấu đỏ)" : "Nhập mã đơn..."} className={cn("text-sm h-9", isOutOfStock && "border-red-500")} disabled={addOrderMutation.isPending} />
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[520px] p-0 z-[100] bg-popover" align="start" side="bottom" sideOffset={4} onOpenAutoFocus={e => e.preventDefault()} onCloseAutoFocus={e => e.preventDefault()} onMouseLeave={() => setIsOpen(false)} onPointerDownOutside={e => {
        const target = e.target as HTMLElement;
        if (target.closest('[role="combobox"]') || target.closest('input[type="text"]')) {
          e.preventDefault();
        }
      }}>
          <Command shouldFilter={false} className="bg-popover">
            <div className="flex items-center justify-between px-3 py-2 border-b">
              <CommandInput placeholder="Tìm mã đơn hoặc tên..." value={inputValue} onValueChange={setInputValue} className="bg-background border-0 flex-1" />
              {hiddenCommentIds.size > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs ml-2" onClick={() => {
              setHiddenCommentIds(new Set());
              toast({
                title: "Đã hiện lại tất cả",
                description: `${hiddenCommentIds.size} comment đã được hiện lại`
              });
            }}>
                  <EyeOff className="mr-1 h-3 w-3" />
                  Hiện {hiddenCommentIds.size}
                </Button>}
            </div>
            <CommandList className="bg-popover">
              <CommandEmpty>Không thấy mã phù hợp.</CommandEmpty>
              <CommandGroup>
                <ScrollArea className="h-[280px]">
                  {flatComments.filter(comment => !inputValue || comment.sessionIndex?.includes(inputValue) || (comment.name || '').toLowerCase().includes(inputValue.toLowerCase()) || (comment.comment || '').toLowerCase().includes(inputValue.toLowerCase())).map(comment => <CommandItem key={comment.id} className="cursor-pointer flex flex-col items-start gap-1 py-3" onSelect={() => handleSelectComment(comment.sessionIndex, comment.facebook_comment_id)}>
                        <div className="flex items-center justify-between gap-2 w-full">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="font-medium shrink-0">#{comment.sessionIndex}</span>
                            <span className="shrink-0">-</span>
                            <span className="font-bold truncate">{comment.name || '(không tên)'}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 text-xs text-muted-foreground">
                            <span>{new Date(comment.created_time).toLocaleTimeString('vi-VN', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}</span>
                            <span className="rounded bg-muted px-2 py-0.5">
                              {comment.remaining}
                            </span>
                            <Button variant="ghost" size="icon" onClick={e => handleHideComment(e, comment.facebook_comment_id)} title="Ẩn comment" className="h-10 w-20 text-muted-foreground hover:text-white hover:bg-destructive transition-colors">
                              <EyeOff className="h-5 w-5" />
                            </Button>
                          </div>
                        </div>
                        {comment.comment && <div className="font-bold text-sm pl-0 w-full">
                            {comment.comment}
                          </div>}
                      </CommandItem>)}
                </ScrollArea>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      
      <Button onClick={handleAddOrder} disabled={addOrderMutation.isPending || !inputValue.trim()} size="sm" className="h-9">
        <Plus className="h-4 w-4" />
      </Button>
    </div>;
}