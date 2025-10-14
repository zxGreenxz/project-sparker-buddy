import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  
  // Step 2: Select multiple TPOS Orders
  const [selectedTPOSOrders, setSelectedTPOSOrders] = useState<Set<string>>(new Set());
  
  // Step 3 & 4: Upload progress and results
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Map<string, { status: 'pending' | 'uploading' | 'success' | 'failed'; message: string }>>(new Map());

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
      setSelectedTPOSOrders(new Set());
      setUploadProgress(new Map());
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

  // Step 2: Handle selection
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedTPOSOrders(new Set(tposOrders.map(o => o.Id)));
    } else {
      setSelectedTPOSOrders(new Set());
    }
  };

  const handleSelectOrder = (orderId: string, checked: boolean) => {
    const newSelected = new Set(selectedTPOSOrders);
    if (checked) {
      newSelected.add(orderId);
    } else {
      newSelected.delete(orderId);
    }
    setSelectedTPOSOrders(newSelected);
  };

  // Step 3: Upload all selected orders
  const handleUploadSelected = async () => {
    if (selectedTPOSOrders.size === 0) {
      toast.error("Vui lòng chọn ít nhất 1 đơn hàng");
      return;
    }

    setIsUploading(true);
    setCurrentStep(3);
    
    const newProgress = new Map<string, { status: 'pending' | 'uploading' | 'success' | 'failed'; message: string }>();
    
    // Initialize progress
    selectedTPOSOrders.forEach(orderId => {
      newProgress.set(orderId, { status: 'pending', message: 'Đang chờ...' });
    });
    setUploadProgress(newProgress);

    let successCount = 0;
    let failedCount = 0;

    // Upload each selected order
    for (const orderId of Array.from(selectedTPOSOrders)) {
      const tposOrder = tposOrders.find(o => o.Id === orderId);
      if (!tposOrder) continue;

      // Update status
      newProgress.set(orderId, { status: 'uploading', message: 'Đang upload...' });
      setUploadProgress(new Map(newProgress));

      try {
        const token = await getActiveTPOSToken();
        if (!token) throw new Error("Chưa có TPOS Bearer Token");

        // 1. Fetch order detail
        const detailUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})?$expand=Details,Partner,User,CRMTeam`;
        const detailResponse = await fetch(detailUrl, {
          headers: getTPOSHeaders(token),
        });
        
        if (!detailResponse.ok) throw new Error(`Lỗi lấy chi tiết đơn`);
        const orderDetail = await detailResponse.json();

        // 2. Search for products
        const productPromises = orders.map(async (order) => {
          const searchUrl = `https://tomato.tpos.vn/odata/Product/ODataService.GetView?$filter=DefaultCode eq '${order.product_code}'&$top=1`;
          const response = await fetch(searchUrl, {
            headers: getTPOSHeaders(token),
          });
          
          if (!response.ok) throw new Error(`Không tìm thấy SP ${order.product_code}`);
          
          const data = await response.json();
          if (!data.value || data.value.length === 0) {
            throw new Error(`Không tìm thấy ${order.product_code} trong TPOS`);
          }
          
          return {
            tposProduct: data.value[0],
            quantity: order.quantity,
            dbOrderId: order.id,
          };
        });
        
        const products = await Promise.all(productPromises);

        // 3. Create new Details
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

        // 4. Update TPOS order
        const updateUrl = `https://tomato.tpos.vn/odata/SaleOnline_Order(${orderId})`;
        const updateResponse = await fetch(updateUrl, {
          method: 'PUT',
          headers: getTPOSHeaders(token),
          body: JSON.stringify({
            ...orderDetail,
            Details: newDetails,
          }),
        });
        
        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          throw new Error(`Lỗi cập nhật: ${updateResponse.status}`);
        }

        // 5. Update database
        await supabase
          .from('live_orders')
          .update({
            tpos_order_id: orderId,
            code_tpos_order_id: tposOrder.Code,
            upload_status: 'success',
            uploaded_at: new Date().toISOString(),
          })
          .in('id', products.map(p => p.dbOrderId));

        newProgress.set(orderId, { 
          status: 'success', 
          message: `Thành công - #${tposOrder.Code}` 
        });
        successCount++;

      } catch (error: any) {
        console.error(`Upload error for ${orderId}:`, error);
        newProgress.set(orderId, { 
          status: 'failed', 
          message: error.message 
        });
        failedCount++;
      }

      setUploadProgress(new Map(newProgress));
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsUploading(false);
    setCurrentStep(4);

    // Summary toast
    if (successCount > 0 && failedCount === 0) {
      toast.success(`✅ Upload thành công ${successCount} đơn hàng`);
    } else if (successCount > 0 && failedCount > 0) {
      toast.warning(`Thành công: ${successCount}, Thất bại: ${failedCount}`);
    } else {
      toast.error(`❌ Upload thất bại ${failedCount} đơn hàng`);
    }
  };

  const resetTool = () => {
    setCurrentStep(1);
    setTPOSOrders([]);
    setSelectedTPOSOrders(new Set());
    setUploadProgress(new Map());
    handleFetchTPOSOrders();
  };

  const allSelected = tposOrders.length > 0 && selectedTPOSOrders.size === tposOrders.length;

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

          {/* Step 2: Select TPOS Orders */}
          {currentStep === 2 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">
                  🛍️ Bước 2: Chọn đơn hàng TPOS ({tposOrders.length})
                </h3>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={allSelected}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Mã đơn</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Điện thoại</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-right">Số lượng</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tposOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Không tìm thấy đơn hàng TPOS nào
                        </TableCell>
                      </TableRow>
                    ) : (
                      tposOrders.map((order) => (
                        <TableRow key={order.Id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedTPOSOrders.has(order.Id)}
                              onCheckedChange={(checked) => handleSelectOrder(order.Id, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-bold">#{order.Code}</TableCell>
                          <TableCell>{order.Name}</TableCell>
                          <TableCell>{order.Telephone}</TableCell>
                          <TableCell className="text-right font-medium text-primary">
                            {order.TotalAmount?.toLocaleString('vi-VN')}₫
                          </TableCell>
                          <TableCell className="text-right">
                            {order.TotalQuantity}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Upload Progress */}
          {currentStep === 3 && (
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-4">
                  📤 Bước 3: Đang upload ({selectedTPOSOrders.size} đơn)
                </h3>
                
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã đơn TPOS</TableHead>
                      <TableHead>Trạng thái</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(selectedTPOSOrders).map((orderId) => {
                      const order = tposOrders.find(o => o.Id === orderId);
                      const progress = uploadProgress.get(orderId);
                      
                      return (
                        <TableRow key={orderId}>
                          <TableCell className="font-medium">
                            #{order?.Code || orderId}
                          </TableCell>
                          <TableCell>
                            {progress && (
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
                                    <span className="text-sm text-green-600">{progress.message}</span>
                                  </>
                                )}
                                {progress.status === 'failed' && (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-600" />
                                    <span className="text-sm text-red-600">{progress.message}</span>
                                  </>
                                )}
                                {progress.status === 'pending' && (
                                  <span className="text-sm text-muted-foreground">{progress.message}</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Summary Results */}
          {currentStep === 4 && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  {Array.from(uploadProgress.values()).every(p => p.status === 'success') ? (
                    <>
                      <CheckCircle2 className="h-16 w-16 text-green-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold text-green-600 mb-2">
                        ✅ Upload thành công!
                      </h3>
                      <p className="text-muted-foreground">
                        Đã upload thành công {selectedTPOSOrders.size} đơn hàng
                      </p>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-16 w-16 text-yellow-600 mx-auto mb-4" />
                      <h3 className="text-2xl font-bold mb-2">
                        Upload hoàn tất
                      </h3>
                      <p className="text-muted-foreground">
                        Thành công: {Array.from(uploadProgress.values()).filter(p => p.status === 'success').length} / 
                        Thất bại: {Array.from(uploadProgress.values()).filter(p => p.status === 'failed').length}
                      </p>
                    </>
                  )}
                </div>

                {/* Show detailed results */}
                <Table className="mt-4">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mã đơn</TableHead>
                      <TableHead>Kết quả</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Array.from(uploadProgress.entries()).map(([orderId, progress]) => {
                      const order = tposOrders.find(o => o.Id === orderId);
                      return (
                        <TableRow key={orderId}>
                          <TableCell>#{order?.Code || orderId}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {progress.status === 'success' && (
                                <>
                                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                                  <span className="text-green-600">{progress.message}</span>
                                </>
                              )}
                              {progress.status === 'failed' && (
                                <>
                                  <XCircle className="h-4 w-4 text-red-600" />
                                  <span className="text-red-600">{progress.message}</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </ScrollArea>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              {currentStep === 2 && `Đã chọn: ${selectedTPOSOrders.size}/${tposOrders.length} đơn`}
              {currentStep === 3 && `Đang upload ${selectedTPOSOrders.size} đơn hàng...`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isFetchingOrders || isUploading}
              >
                Đóng
              </Button>
              
              {currentStep === 2 && (
                <Button
                  onClick={handleUploadSelected}
                  disabled={selectedTPOSOrders.size === 0}
                >
                  Upload {selectedTPOSOrders.size} đơn đã chọn
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
