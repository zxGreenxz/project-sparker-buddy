import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, Upload } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { uploadOrderToTPOS } from "@/lib/tpos-order-uploader";
import { toast } from "sonner";

interface LiveOrder {
  id: string;
  live_session_id: string;
  live_product_id: string;
  live_phase_id?: string;
  order_code: string;
  tpos_order_id?: string | null;
  code_tpos_order_id?: string | null;
  quantity: number;
  order_date: string;
  is_oversell?: boolean;
  uploaded_at?: string | null;
  upload_status?: string | null;
  customer_status?: string;
}

interface OrderWithProduct extends LiveOrder {
  product_code: string;
  product_name: string;
  product_images?: string[];
  customer_status?: string;
}

interface UploadOrdersToTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderWithProduct[];
  sessionId: string | null;
  phaseId: string | null;
}

interface UploadProgress {
  status: 'pending' | 'uploading' | 'success' | 'failed';
  message: string;
  codeTPOSOrderId?: string;
}

export function UploadOrdersToTPOSDialog({
  open,
  onOpenChange,
  orders,
  sessionId,
}: UploadOrdersToTPOSDialogProps) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Map<string, UploadProgress>>(new Map());
  const [isUploading, setIsUploading] = useState(false);

  // Fetch session info
  const { data: sessionData } = useQuery({
    queryKey: ['live-session', sessionId],
    queryFn: async () => {
      if (!sessionId) return null;
      
      const { data, error } = await supabase
        .from('live_sessions')
        .select('start_date, end_date, session_name')
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      
      // Extract session index from session_name (e.g., "Đợt 3" -> 3)
      const sessionIndex = data.session_name?.match(/\d+/)?.[0] || '1';
      
      return {
        ...data,
        session_index: parseInt(sessionIndex),
      };
    },
    enabled: !!sessionId && open,
  });

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedOrders(new Set());
      setUploadProgress(new Map());
      setIsUploading(false);
    }
  }, [open]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      // Get unique order codes
      const uniqueOrderCodes = [...new Set(orders.map(o => o.order_code))];
      setSelectedOrders(new Set(uniqueOrderCodes));
    } else {
      setSelectedOrders(new Set());
    }
  };

  const handleSelectOrder = (orderCode: string, checked: boolean) => {
    const newSelected = new Set(selectedOrders);
    if (checked) {
      newSelected.add(orderCode);
    } else {
      newSelected.delete(orderCode);
    }
    setSelectedOrders(newSelected);
  };

  const handleUpload = async () => {
    if (!sessionData) {
      toast.error("Không thể tải thông tin session");
      return;
    }

    setIsUploading(true);
    const newProgress = new Map<string, UploadProgress>();
    
    // Group orders by order_code
    const orderGroups = orders.reduce((groups, order) => {
      if (!groups[order.order_code]) {
        groups[order.order_code] = [];
      }
      groups[order.order_code].push(order);
      return groups;
    }, {} as Record<string, OrderWithProduct[]>);
    
    // Initialize progress for all selected orders
    selectedOrders.forEach(orderCode => {
      newProgress.set(orderCode, {
        status: 'pending',
        message: 'Đang chờ...',
      });
    });
    setUploadProgress(newProgress);

    let successCount = 0;
    let failedCount = 0;

    // Upload orders sequentially
    for (const orderCode of Array.from(selectedOrders)) {
      const orderItems = orderGroups[orderCode];
      if (!orderItems || orderItems.length === 0) continue;

      // Update status to uploading
      newProgress.set(orderCode, {
        status: 'uploading',
        message: 'Đang upload...',
      });
      setUploadProgress(new Map(newProgress));

      try {
        // Convert order items to products array
        const products = orderItems.map(item => ({
          product_code: item.product_code,
          product_name: item.product_name,
          quantity: item.quantity,
        }));
        
        const result = await uploadOrderToTPOS({
          orderCode,
          products,
          sessionInfo: {
            start_date: sessionData.start_date,
            end_date: sessionData.end_date,
            session_index: sessionData.session_index,
          },
          onProgress: (step, message) => {
            newProgress.set(orderCode, {
              status: 'uploading',
              message: `Bước ${step}/4: ${message}`,
            });
            setUploadProgress(new Map(newProgress));
          },
        });

        if (result.success) {
          newProgress.set(orderCode, {
            status: 'success',
            message: 'Upload thành công',
            codeTPOSOrderId: result.codeTPOSOrderId,
          });
          successCount++;
        } else {
          newProgress.set(orderCode, {
            status: 'failed',
            message: result.error || 'Upload thất bại',
          });
          failedCount++;
        }
      } catch (error) {
        newProgress.set(orderCode, {
          status: 'failed',
          message: error instanceof Error ? error.message : 'Lỗi không xác định',
        });
        failedCount++;
      }

      setUploadProgress(new Map(newProgress));
      
      // Delay between uploads to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsUploading(false);

    // Show summary toast
    if (successCount > 0 && failedCount === 0) {
      toast.success(`Upload thành công ${successCount} đơn hàng`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`Thành công: ${successCount}, Thất bại: ${failedCount}`);
    } else {
      toast.error(`Upload thất bại ${failedCount} đơn hàng`);
    }
  };

  // Calculate unique order codes count
  const uniqueOrderCodes = [...new Set(orders.map(o => o.order_code))];
  const allSelected = uniqueOrderCodes.length > 0 && selectedOrders.size === uniqueOrderCodes.length;
  const someSelected = selectedOrders.size > 0 && selectedOrders.size < uniqueOrderCodes.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload đơn hàng lên TPOS</DialogTitle>
          {sessionData && (
            <p className="text-sm text-muted-foreground">
              Khoảng ngày: {new Date(sessionData.start_date).toLocaleDateString('vi-VN')} - {new Date(sessionData.end_date).toLocaleDateString('vi-VN')} | 
              Session Index: {sessionData.session_index}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mã đơn</TableHead>
                <TableHead>Sản phẩm</TableHead>
                <TableHead className="text-right">Tổng SL</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="w-12 text-center">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    disabled={isUploading}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                // Group orders by order_code
                const orderGroups = orders.reduce((groups, order) => {
                  if (!groups[order.order_code]) {
                    groups[order.order_code] = [];
                  }
                  groups[order.order_code].push(order);
                  return groups;
                }, {} as Record<string, OrderWithProduct[]>);

                const orderCodes = Object.keys(orderGroups);

                if (orderCodes.length === 0) {
                  return (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Không có đơn hàng nào
                      </TableCell>
                    </TableRow>
                  );
                }

                return orderCodes.map((orderCode) => {
                  const orderItems = orderGroups[orderCode];
                  const firstOrder = orderItems[0];
                  const totalQuantity = orderItems.reduce((sum, item) => sum + item.quantity, 0);
                  const progress = uploadProgress.get(orderCode);
                  
                  return (
                    <TableRow key={orderCode}>
                      <TableCell className="font-medium">{orderCode}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {orderItems.slice(0, 2).map((item, i) => (
                            <div key={i}>
                              {item.product_code} ({item.quantity})
                            </div>
                          ))}
                          {orderItems.length > 2 && (
                            <div className="text-muted-foreground">
                              +{orderItems.length - 2} sản phẩm khác
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {totalQuantity}
                      </TableCell>
                      <TableCell>
                        {progress ? (
                          <div className="flex items-center gap-2">
                            {progress.status === 'uploading' && (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">{progress.message}</span>
                              </>
                            )}
                            {progress.status === 'success' && (
                              <>
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                <div className="text-sm">
                                  <div className="text-green-600">Thành công</div>
                                  {progress.codeTPOSOrderId && (
                                    <div className="text-muted-foreground">{progress.codeTPOSOrderId}</div>
                                  )}
                                </div>
                              </>
                            )}
                            {progress.status === 'failed' && (
                              <>
                                <XCircle className="h-4 w-4 text-red-600" />
                                <span className="text-sm text-red-600">{progress.message}</span>
                              </>
                            )}
                            {progress.status === 'pending' && (
                              <Badge variant="outline">Đang chờ</Badge>
                            )}
                          </div>
                        ) : firstOrder.upload_status === 'success' && firstOrder.code_tpos_order_id ? (
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <div className="text-sm">
                              <div className="text-green-600">Đã upload</div>
                              <div className="text-muted-foreground">{firstOrder.code_tpos_order_id}</div>
                            </div>
                          </div>
                        ) : (
                          <Badge variant="outline">Chưa upload</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={selectedOrders.has(orderCode)}
                          onCheckedChange={(checked) => handleSelectOrder(orderCode, checked as boolean)}
                          disabled={isUploading}
                        />
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
            </TableBody>
          </Table>
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              Đã chọn: {selectedOrders.size}/{uniqueOrderCodes.length} đơn
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isUploading}
              >
                {isUploading ? 'Đóng' : 'Hủy'}
              </Button>
              <Button
                onClick={handleUpload}
                disabled={selectedOrders.size === 0 || isUploading || !sessionData}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Đang upload...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Upload đã chọn
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
