import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getTPOSHeaders, getActiveTPOSToken } from "@/lib/tpos-config";
import { cn } from "@/lib/utils";

// TPOS Order from API
interface TPOSOrder {
  Id: string;
  Code: string;
  Name: string;
  Telephone: string;
  TotalAmount: number;
  TotalQuantity: number;
  DateCreated: string;
}

interface TPOSOrderDetail {
  Id: string;
  Code: string;
  Name: string;
  Details: any[];
  Partner: any;
  User: any;
  CRMTeam: any;
}

// Live Order from DB
interface OrderWithProduct {
  id: string;
  order_code: string;
  product_code: string;
  product_name: string;
  quantity: number;
  live_session_id: string;
}

interface UploadOrdersToTPOSDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orders: OrderWithProduct[];
  sessionId: string | null;
  phaseId: string | null;
}

export function UploadOrdersToTPOSDialog({
  open,
  onOpenChange,
  orders,
  sessionId,
}: UploadOrdersToTPOSDialogProps) {
  // Step state
  const [currentStep, setCurrentStep] = useState(1);
  
  // Step 1: Auto-fetch TPOS orders
  const [isFetchingOrders, setIsFetchingOrders] = useState(false);
  const [tposOrders, setTPOSOrders] = useState<TPOSOrder[]>([]);
  
  // Step 2: Select TPOS Order
  const [selectedTPOSOrder, setSelectedTPOSOrder] = useState<TPOSOrder | null>(null);
  
  // Step 3 & 4: Order detail and update
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);
  const [orderDetail, setOrderDetail] = useState<TPOSOrderDetail | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateResult, setUpdateResult] = useState<any>(null);

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

  // Format date for TPOS API with GMT+7 timezone
  const formatDateForAPI = (dateStr: string, isEndDate = false) => {
    const date = new Date(dateStr);
    
    if (isEndDate) {
      date.setHours(16, 59, 59, 0);
    } else {
      date.setHours(17, 0, 0, 0);
      date.setDate(date.getDate() - 1);
    }
    
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
  };

  // Auto-fetch TPOS orders when dialog opens
  useEffect(() => {
    if (open && sessionData && currentStep === 1) {
      handleFetchTPOSOrders();
    }
  }, [open, sessionData]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setCurrentStep(1);
      setTPOSOrders([]);
      setSelectedTPOSOrder(null);
      setOrderDetail(null);
      setUpdateResult(null);
    }
  }, [open]);

  // Step 1: Auto-fetch TPOS orders based on session dates
  const handleFetchTPOSOrders = async () => {
    if (!sessionData) return;

    setIsFetchingOrders(true);
    setTPOSOrders([]);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Chưa có TPOS Bearer Token");
      }
      
      const startDateTime = formatDateForAPI(sessionData.start_date, false);
      const endDateTime = formatDateForAPI(sessionData.end_date, true);
      
      console.log('📅 Fetching TPOS orders:', {
        start_date: sessionData.start_date,
        end_date: sessionData.end_date,
        session_index: sessionData.session_index,
        startDateTime,
        endDateTime,
      });
      
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order/ODataService.GetView?$top=50&$orderby=DateCreated desc&$filter=(DateCreated ge ${startDateTime} and DateCreated le ${endDateTime} and SessionIndex eq ${sessionData.session_index})&$count=true`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getTPOSHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setTPOSOrders(data.value || []);
      
      toast.success(`Tìm thấy ${data['@odata.count'] || data.value?.length || 0} đơn hàng TPOS`);
      
      setCurrentStep(2);
    } catch (error: any) {
      console.error("Fetch TPOS orders error:", error);
      toast.error(`Lỗi tìm đơn hàng: ${error.message}`);
    } finally {
      setIsFetchingOrders(false);
    }
  };

  // Step 2: User selects a TPOS order
  const handleSelectTPOSOrder = (order: TPOSOrder) => {
    setSelectedTPOSOrder(order);
  };

  const handleContinue = async () => {
    if (!selectedTPOSOrder) {
      toast.error("Vui lòng chọn đơn hàng TPOS");
      return;
    }

    setIsFetchingDetail(true);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Chưa có TPOS Bearer Token");
      }
      
      const url = `https://tomato.tpos.vn/odata/SaleOnline_Order(${selectedTPOSOrder.Id})?$expand=Details,Partner,User,CRMTeam`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: getTPOSHeaders(token),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setOrderDetail(data);
      
      toast.success(`Đã tải chi tiết đơn #${data.Code}`);
      
      setCurrentStep(3);
    } catch (error: any) {
      console.error("Fetch detail error:", error);
      toast.error(`Lỗi lấy chi tiết đơn: ${error.message}`);
    } finally {
      setIsFetchingDetail(false);
    }
  };

  // Step 4: Update TPOS order with products
  const handleUpdateOrder = async () => {
    if (!orderDetail || orders.length === 0) {
      toast.error("Không có sản phẩm để upload");
      return;
    }

    setIsUpdating(true);
    setUpdateResult(null);
    
    try {
      const token = await getActiveTPOSToken();
      if (!token) {
        throw new Error("Chưa có TPOS Bearer Token");
      }
      
      // Search for each product on TPOS
      const productPromises = orders.map(async (order) => {
        const searchUrl = `https://tomato.tpos.vn/odata/Product/ODataService.GetView?$filter=DefaultCode eq '${order.product_code}'&$top=1`;
        const response = await fetch(searchUrl, {
          headers: getTPOSHeaders(token),
        });
        
        if (!response.ok) {
          throw new Error(`Không tìm thấy sản phẩm ${order.product_code}`);
        }
        
        const data = await response.json();
        if (!data.value || data.value.length === 0) {
          throw new Error(`Không tìm thấy sản phẩm ${order.product_code} trong TPOS`);
        }
        
        return {
          tposProduct: data.value[0],
          quantity: order.quantity,
          dbOrderId: order.id,
        };
      });
      
      const products = await Promise.all(productPromises);
      
      // Create new Details array
      const newDetails = products.map(({ tposProduct, quantity }) => ({
        ProductId: tposProduct.Id,
        ProductName: tposProduct.Name,
        ProductNameGet: tposProduct.NameGet,
        Quantity: quantity,
        Price: tposProduct.ListPrice || tposProduct.PriceVariant || 0,
        UOMId: 1,
        UOMName: "Cái",
        Factor: 1,
        ProductWeight: 0,
      }));
      
      // Update order on TPOS
      const updateUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderDetail.Id})`;
      const payload = {
        ...orderDetail,
        Details: newDetails,
      };
      
      const updateResponse = await fetch(updateUrl, {
        method: 'PUT',
        headers: getTPOSHeaders(token),
        body: JSON.stringify(payload),
      });
      
      if (!updateResponse.ok) {
        const errorText = await updateResponse.text();
        throw new Error(`Lỗi cập nhật: ${updateResponse.status} - ${errorText}`);
      }
      
      // Update database - mark orders as uploaded
      const { error: dbError } = await supabase
        .from('live_orders')
        .update({
          tpos_order_id: selectedTPOSOrder.Id,
          code_tpos_order_id: selectedTPOSOrder.Code,
          upload_status: 'success',
          uploaded_at: new Date().toISOString(),
        })
        .in('id', products.map(p => p.dbOrderId));

      if (dbError) {
        console.error('DB update error:', dbError);
      }
      
      setUpdateResult({
        success: true,
        productsAdded: newDetails.length,
        orderCode: orderDetail.Code,
      });
      
      toast.success(`✅ Đã cập nhật ${newDetails.length} sản phẩm vào đơn #${orderDetail.Code}`);
      
      setCurrentStep(4);
    } catch (error: any) {
      console.error("Update error:", error);
      toast.error(`Lỗi cập nhật: ${error.message}`);
      setUpdateResult({
        success: false,
        error: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const resetTool = () => {
    setCurrentStep(1);
    setTPOSOrders([]);
    setSelectedTPOSOrder(null);
    setOrderDetail(null);
    setUpdateResult(null);
    handleFetchTPOSOrders();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Upload đơn hàng lên TPOS - 4 Bước</DialogTitle>
          {sessionData && (
            <p className="text-sm text-muted-foreground">
              Khoảng ngày: {new Date(sessionData.start_date).toLocaleDateString('vi-VN')} - {new Date(sessionData.end_date).toLocaleDateString('vi-VN')} | 
              Session Index: {sessionData.session_index}
            </p>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {/* Progress Steps */}
          <Card className="mb-4">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                    currentStep >= 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    1
                  </div>
                  <div className={cn(
                    "w-20 h-1",
                    currentStep >= 2 ? "bg-primary" : "bg-muted"
                  )} />
                </div>
                <div className="flex items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                    currentStep >= 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    2
                  </div>
                  <div className={cn(
                    "w-20 h-1",
                    currentStep >= 3 ? "bg-primary" : "bg-muted"
                  )} />
                </div>
                <div className="flex items-center">
                  <div className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                    currentStep >= 3 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    3
                  </div>
                  <div className={cn(
                    "w-20 h-1",
                    currentStep >= 4 ? "bg-primary" : "bg-muted"
                  )} />
                </div>
                <div className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center font-bold",
                  currentStep >= 4 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  4
                </div>
              </div>
              <div className="flex justify-between mt-2 text-sm text-muted-foreground">
                <span>Tìm đơn</span>
                <span>Chọn đơn</span>
                <span>Sản phẩm</span>
                <span>Cập nhật</span>
              </div>
            </CardContent>
          </Card>

          {/* Step 1: Auto-fetching (showing loading state) */}
          {currentStep === 1 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                  <p className="text-lg font-medium">Đang tìm đơn hàng TPOS...</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Vui lòng chờ trong giây lát
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select TPOS Order */}
          {currentStep === 2 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">
                  🛍️ Bước 2: Chọn đơn hàng TPOS ({tposOrders.length})
                </h3>
                <div className="max-h-96 overflow-y-auto space-y-3">
                  {tposOrders.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Không tìm thấy đơn hàng TPOS nào
                    </p>
                  ) : (
                    tposOrders.map((order) => (
                      <div
                        key={order.Id}
                        onClick={() => handleSelectTPOSOrder(order)}
                        className={cn(
                          "p-4 border-2 rounded-lg cursor-pointer transition",
                          selectedTPOSOrder?.Id === order.Id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold">#{order.Code}</p>
                            <p className="text-sm text-muted-foreground">{order.Name}</p>
                            <p className="text-sm text-muted-foreground">{order.Telephone}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold text-primary">
                              {order.TotalAmount?.toLocaleString('vi-VN')}₫
                            </p>
                            <p className="text-sm text-muted-foreground">
                              SL: {order.TotalQuantity}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Show products to upload */}
          {currentStep === 3 && orderDetail && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">
                  📦 Bước 3: Sản phẩm sẽ upload
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Đơn TPOS: #{orderDetail.Code} - {orderDetail.Name}
                </p>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã SP</TableHead>
                      <TableHead>Tên sản phẩm</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{order.product_code}</TableCell>
                        <TableCell>{order.product_name}</TableCell>
                        <TableCell className="text-right font-medium">{order.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Update Result */}
          {currentStep === 4 && updateResult && (
            <Card>
              <CardContent className="pt-6">
                {updateResult.success ? (
                  <div className="text-center py-8">
                    <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-green-600 mb-2">
                      ✅ Cập nhật thành công!
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Đã cập nhật {updateResult.productsAdded} sản phẩm vào đơn #{updateResult.orderCode}
                    </p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <XCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-bold text-red-600 mb-2">
                      ❌ Cập nhật thất bại
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      {updateResult.error}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {currentStep === 3 && `${orders.length} sản phẩm sẽ được upload`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isFetchingOrders || isFetchingDetail || isUpdating}
              >
                Đóng
              </Button>
              
              {currentStep === 2 && (
                <Button
                  onClick={handleContinue}
                  disabled={!selectedTPOSOrder || isFetchingDetail}
                >
                  {isFetchingDetail ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang tải...
                    </>
                  ) : (
                    "Tiếp tục"
                  )}
                </Button>
              )}
              
              {currentStep === 3 && (
                <Button
                  onClick={handleUpdateOrder}
                  disabled={isUpdating || orders.length === 0}
                >
                  {isUpdating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Đang cập nhật...
                    </>
                  ) : (
                    "Cập nhật đơn TPOS"
                  )}
                </Button>
              )}
              
              {currentStep === 4 && (
                <Button onClick={resetTool}>
                  Làm lại
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
