import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader2, CheckCircle, XCircle, Upload } from "lucide-react";
import { uploadOrderToTPOS } from "@/lib/tpos-order-uploader";

interface OrderWithProduct {
  id: string;
  order_code: string;
  product_code: string;
  product_name: string;
  quantity: number;
  variant?: string | null;
  upload_status?: string | null;
  live_product_id: string;
}

interface UploadLiveOrdersToTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordersWithProducts: OrderWithProduct[];
  sessionId: string | null;
}

interface UploadProgress {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message?: string;
  step?: number;
}

interface GroupedOrder {
  order_code: string;
  products: Array<{
    product_code: string;
    product_name: string;
    quantity: number;
    variant?: string | null;
    orderItemIds: string[]; // ✅ Track live_orders IDs for this product
  }>;
  totalQuantity: number;
  uploadStatus?: string | null;
  hasUploadedItems: boolean; // ✅ Has at least one uploaded item
}

export function UploadLiveOrdersToTPOSDialog({
  open,
  onOpenChange,
  ordersWithProducts,
  sessionId,
}: UploadLiveOrdersToTPOSDialogProps) {
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [isUploading, setIsUploading] = useState(false);

  // Fetch session data
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
      return data;
    },
    enabled: !!sessionId && open,
  });

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedOrders(new Set());
      setUploadProgress({});
      setIsUploading(false);
    }
  }, [open]);

  // Group orders by order_code, skip uploaded items
  const groupedOrders = useMemo<GroupedOrder[]>(() => {
    const groups = ordersWithProducts.reduce((acc, order) => {
      // ✅ Skip items that have already been uploaded successfully
      if (order.upload_status === 'success') {
        // Still track that this order_code has uploaded items
        if (!acc[order.order_code]) {
          acc[order.order_code] = {
            order_code: order.order_code,
            products: [],
            totalQuantity: 0,
            uploadStatus: null,
            hasUploadedItems: true,
          };
        } else {
          acc[order.order_code].hasUploadedItems = true;
        }
        return acc;
      }

      if (!acc[order.order_code]) {
        acc[order.order_code] = {
          order_code: order.order_code,
          products: [],
          totalQuantity: 0,
          uploadStatus: order.upload_status,
          hasUploadedItems: false,
        };
      }
      
      // Find existing product in the products array
      const existingProduct = acc[order.order_code].products.find(
        p => p.product_code === order.product_code
      );
      
      if (existingProduct) {
        // If exists, add to quantity and track ID
        existingProduct.quantity += order.quantity;
        existingProduct.orderItemIds.push(order.id);
      } else {
        // If new, add to products array
        acc[order.order_code].products.push({
          product_code: order.product_code,
          product_name: order.product_name,
          quantity: order.quantity,
          variant: order.variant,
          orderItemIds: [order.id], // ✅ Track IDs
        });
      }
      
      acc[order.order_code].totalQuantity += order.quantity;
      return acc;
    }, {} as Record<string, GroupedOrder>);

    // ✅ Only keep order_codes with at least one non-uploaded product
    return Object.values(groups)
      .filter(g => g.products.length > 0)
      .sort((a, b) => parseInt(a.order_code) - parseInt(b.order_code));
  }, [ordersWithProducts]);

  // Handle select all / deselect all
  const handleSelectAll = () => {
    if (selectedOrders.size === groupedOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(groupedOrders.map(g => g.order_code)));
    }
  };

  // Handle individual selection
  const handleSelectOrder = (orderCode: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderCode)) {
      newSelected.delete(orderCode);
    } else {
      newSelected.add(orderCode);
    }
    setSelectedOrders(newSelected);
  };

  // Handle upload
  const handleUpload = async () => {
    if (!sessionData) {
      toast.error("Không tìm thấy thông tin phiên live");
      return;
    }

    if (selectedOrders.size === 0) {
      toast.error("Vui lòng chọn ít nhất một đơn hàng");
      return;
    }

    setIsUploading(true);
    const selectedOrdersList = Array.from(selectedOrders);
    
    // Initialize progress for all selected orders
    const initialProgress: Record<string, UploadProgress> = {};
    selectedOrdersList.forEach(orderCode => {
      initialProgress[orderCode] = { status: 'idle' };
    });
    setUploadProgress(initialProgress);

    let successCount = 0;
    let failedCount = 0;

    // Process each order
    for (const orderCode of selectedOrdersList) {
      const groupedOrder = groupedOrders.find(g => g.order_code === orderCode);
      if (!groupedOrder || groupedOrder.products.length === 0) continue;

      // ✅ Collect all orderItemIds that need to be uploaded
      const allOrderItemIds = groupedOrder.products.flatMap(p => p.orderItemIds);

      // Update status to uploading
      setUploadProgress(prev => ({
        ...prev,
        [orderCode]: { status: 'uploading', message: 'Đang xử lý...' }
      }));

      try {
        // Use order_code as session_index
        const sessionIndex = parseInt(orderCode);
        
        const result = await uploadOrderToTPOS({
          orderCode,
          products: groupedOrder.products.map(p => ({
            product_code: p.product_code,
            product_name: p.product_name,
            quantity: p.quantity,
          })),
          sessionInfo: {
            start_date: sessionData.start_date,
            end_date: sessionData.end_date,
            session_index: sessionIndex,
          },
          orderItemIds: allOrderItemIds, // ✅ Pass specific IDs
          onProgress: (step, message) => {
            setUploadProgress(prev => ({
              ...prev,
              [orderCode]: { status: 'uploading', message, step }
            }));
          },
        });

        if (result.success) {
          setUploadProgress(prev => ({
            ...prev,
            [orderCode]: { 
              status: 'success', 
              message: `Đã thêm ${groupedOrder.products.length} sản phẩm vào đơn TPOS: ${result.codeTPOSOrderId}` 
            }
          }));
          successCount++;
        } else {
          setUploadProgress(prev => ({
            ...prev,
            [orderCode]: { 
              status: 'error', 
              message: result.error || 'Lỗi không xác định' 
            }
          }));
          failedCount++;
        }
      } catch (error) {
        console.error(`Error uploading order ${orderCode}:`, error);
        setUploadProgress(prev => ({
          ...prev,
          [orderCode]: { 
            status: 'error', 
            message: error instanceof Error ? error.message : 'Lỗi không xác định' 
          }
        }));
        failedCount++;
      }
    }

    setIsUploading(false);

    // Show summary toast
    if (successCount > 0 && failedCount === 0) {
      toast.success(`Đã upload thành công ${successCount} đơn hàng`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`Upload hoàn tất: ${successCount} thành công, ${failedCount} thất bại`);
    } else if (failedCount > 0) {
      toast.error(`Upload thất bại ${failedCount} đơn hàng`);
    }
  };

  const renderUploadStatus = (orderCode: string) => {
    const progress = uploadProgress[orderCode];
    if (!progress) return null;

    switch (progress.status) {
      case 'uploading':
        return (
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <span className="text-xs text-muted-foreground">{progress.message}</span>
          </div>
        );
      case 'success':
        return (
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-xs text-green-600">{progress.message}</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-500" />
            <span className="text-xs text-red-600">{progress.message}</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload đơn hàng lên TPOS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {sessionData && (
            <div className="bg-muted p-3 rounded-md">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">Phiên live:</span> {sessionData.session_name}
                </div>
                <div>
                  <span className="font-medium">Thời gian:</span>{' '}
                  {new Date(sessionData.start_date).toLocaleDateString('vi-VN')} -{' '}
                  {new Date(sessionData.end_date).toLocaleDateString('vi-VN')}
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={selectedOrders.size === groupedOrders.length && groupedOrders.length > 0}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm font-medium">
                Chọn tất cả ({selectedOrders.size}/{groupedOrders.length})
              </span>
            </div>
          </div>

          <ScrollArea className="h-[400px] border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Mã đơn</TableHead>
                  <TableHead>Sản phẩm</TableHead>
                  <TableHead className="text-center">Tổng SL</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupedOrders.map((group) => (
                  <TableRow key={group.order_code}>
                    <TableCell>
                      <Checkbox
                        checked={selectedOrders.has(group.order_code)}
                        onCheckedChange={() => handleSelectOrder(group.order_code)}
                        disabled={isUploading}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{group.order_code}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {group.products.map((product, idx) => (
                          <div key={idx} className="text-sm">
                            <span className="font-medium">{product.product_code}</span>
                            {' - '}
                            <span className="text-muted-foreground">
                              {product.product_name}
                              {product.variant && ` (${product.variant})`}
                            </span>
                            {' x '}
                            <span className="font-semibold">{product.quantity}</span>
                          </div>
                        ))}
                        {/* ✅ Show badge if some items are already uploaded */}
                        {group.hasUploadedItems && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            ✓ Một số sản phẩm đã upload
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{group.totalQuantity}</Badge>
                    </TableCell>
                    <TableCell>
                      {renderUploadStatus(group.order_code) || (
                        group.uploadStatus === 'success' ? (
                          <Badge variant="default" className="bg-green-500">Đã upload</Badge>
                        ) : null
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUploading}
          >
            Hủy
          </Button>
          <Button
            onClick={handleUpload}
            disabled={selectedOrders.size === 0 || isUploading}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Đang upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload {selectedOrders.size > 0 ? `${selectedOrders.size} đơn` : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
