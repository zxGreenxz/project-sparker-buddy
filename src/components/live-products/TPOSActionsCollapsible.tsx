import { useState, useEffect } from "react";
import { ChevronDown, Calendar, Download, RefreshCw, Upload, CheckCircle } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TPOSActionsCollapsibleProps {
  hasOrders: boolean;
  // Đồng bộ TPOS Order
  tposSyncDateRange: DateRange | undefined;
  setTposSyncDateRange: (range: DateRange | undefined) => void;
  tposTopValue: string;
  setTposTopValue: (value: string) => void;
  handleSyncTposOrders: () => void;
  isSyncingTpos: boolean;
  tposSyncResult: { matched: number; notFound: number; errors: number } | null;
  
  // Upload TPOS
  setIsUploadTPOSOpen: (open: boolean) => void;
  
  // Đồng bộ Product IDs
  maxRecordsToFetch: string;
  setMaxRecordsToFetch: (value: string) => void;
  handleSyncProductIds: () => void;
  isSyncingProductIds: boolean;
  productIdSyncResult: { matched: number; notFound: number; errors: number } | null;
}

export function TPOSActionsCollapsible({
  hasOrders,
  tposSyncDateRange,
  setTposSyncDateRange,
  tposTopValue,
  setTposTopValue,
  handleSyncTposOrders,
  isSyncingTpos,
  tposSyncResult,
  setIsUploadTPOSOpen,
  maxRecordsToFetch,
  setMaxRecordsToFetch,
  handleSyncProductIds,
  isSyncingProductIds,
  productIdSyncResult,
}: TPOSActionsCollapsibleProps) {
  const [isOpen, setIsOpen] = useState(() => {
    const saved = localStorage.getItem("tpos-actions-open");
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    localStorage.setItem("tpos-actions-open", JSON.stringify(isOpen));
  }, [isOpen]);

  if (!hasOrders) return null;

  return (
    <Card className="border-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer bg-muted/50 hover:bg-muted transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                🔧 Thao tác TPOS
              </CardTitle>
              <ChevronDown
                className={`h-5 w-5 transition-transform duration-200 ${
                  isOpen ? "transform rotate-180" : ""
                }`}
              />
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="space-y-4 pt-4">
            {/* Section 1: Đồng bộ mã TPOS Order */}
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold mb-3">Đồng bộ mã TPOS Order</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Khoảng thời gian</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-[280px] justify-start text-left font-normal"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {tposSyncDateRange?.from ? (
                          tposSyncDateRange.to ? (
                            <>
                              {format(tposSyncDateRange.from, "dd/MM/yyyy", { locale: vi })} -{" "}
                              {format(tposSyncDateRange.to, "dd/MM/yyyy", { locale: vi })}
                            </>
                          ) : (
                            format(tposSyncDateRange.from, "dd/MM/yyyy", { locale: vi })
                          )
                        ) : (
                          <span>Chọn ngày</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="range"
                        selected={tposSyncDateRange}
                        onSelect={setTposSyncDateRange}
                        numberOfMonths={2}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Số lượng đơn hàng</label>
                  <Select value={tposTopValue} onValueChange={setTposTopValue}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="20">20 đơn</SelectItem>
                      <SelectItem value="50">50 đơn</SelectItem>
                      <SelectItem value="200">200 đơn</SelectItem>
                      <SelectItem value="1000">1000 đơn</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={handleSyncTposOrders}
                  disabled={isSyncingTpos}
                >
                  {isSyncingTpos ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang đồng bộ...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Thêm mã TPOS
                    </>
                  )}
                </Button>
              </div>
              
              {tposSyncResult && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Kết quả</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Đã cập nhật:</span>
                        <Badge>{tposSyncResult.matched}</Badge>
                      </div>
                      {tposSyncResult.notFound > 0 && (
                        <div className="flex justify-between">
                          <span>Không tìm thấy:</span>
                          <Badge variant="outline">{tposSyncResult.notFound}</Badge>
                        </div>
                      )}
                      {tposSyncResult.errors > 0 && (
                        <div className="flex justify-between">
                          <span>Lỗi:</span>
                          <Badge variant="destructive">{tposSyncResult.errors}</Badge>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Section 2: Upload Orders lên TPOS */}
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold mb-3">Upload Orders lên TPOS</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Chọn và upload các đơn hàng lên hệ thống TPOS
              </p>
              <Button onClick={() => setIsUploadTPOSOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Upload TPOS
              </Button>
            </div>

            {/* Section 3: Đồng bộ mã biến thể (Product ID) */}
            <div>
              <h3 className="text-sm font-semibold mb-3">Đồng bộ mã biến thể (Product ID)</h3>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Số lượng records</label>
                  <Select value={maxRecordsToFetch} onValueChange={setMaxRecordsToFetch}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1000">1,000 records</SelectItem>
                      <SelectItem value="2000">2,000 records</SelectItem>
                      <SelectItem value="3000">3,000 records</SelectItem>
                      <SelectItem value="4000">4,000 records (mặc định)</SelectItem>
                      <SelectItem value="5000">5,000 records</SelectItem>
                      <SelectItem value="10000">10,000 records</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <Button
                  onClick={handleSyncProductIds}
                  disabled={isSyncingProductIds}
                >
                  {isSyncingProductIds ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang đồng bộ...
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Đồng bộ mã biến thể
                    </>
                  )}
                </Button>
              </div>
              
              <div className="mt-3 text-sm text-muted-foreground">
                Đồng bộ <strong>productid_bienthe</strong> cho các sản phẩm trong kho chưa có mã (bỏ qua N/A)
              </div>
              
              {productIdSyncResult && (
                <Alert className="mt-4">
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Kết quả</AlertTitle>
                  <AlertDescription>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span>Đã cập nhật:</span>
                        <Badge>{productIdSyncResult.matched}</Badge>
                      </div>
                      {productIdSyncResult.notFound > 0 && (
                        <div className="flex justify-between">
                          <span>Không tìm thấy:</span>
                          <Badge variant="outline">{productIdSyncResult.notFound}</Badge>
                        </div>
                      )}
                      {productIdSyncResult.errors > 0 && (
                        <div className="flex justify-between">
                          <span>Lỗi:</span>
                          <Badge variant="destructive">{productIdSyncResult.errors}</Badge>
                        </div>
                      )}
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
