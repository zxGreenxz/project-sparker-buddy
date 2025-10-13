import { useState, useEffect } from "react";
import { ChevronDown, Download, RefreshCw, Upload, CheckCircle, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

interface TPOSActionsCollapsibleProps {
  hasOrders: boolean;
  // Đồng bộ & Upload
  handleSyncAndUpload: () => void;
  isSyncingTpos: boolean;
  tposSyncDateRange: DateRange | undefined;
  setTposSyncDateRange: (dateRange: DateRange | undefined) => void;
  
  // Đồng bộ Product IDs
  maxRecordsToFetch: string;
  setMaxRecordsToFetch: (value: string) => void;
  handleSyncProductIds: () => void;
  isSyncingProductIds: boolean;
  productIdSyncResult: { matched: number; notFound: number; errors: number } | null;
}

export function TPOSActionsCollapsible({
  hasOrders,
  handleSyncAndUpload,
  isSyncingTpos,
  tposSyncDateRange,
  setTposSyncDateRange,
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
            {/* Section 1: Đồng bộ & Upload Orders lên TPOS */}
            <div className="border-b pb-4">
              <h3 className="text-sm font-semibold mb-3">Đồng bộ & Upload Orders lên TPOS</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Tự động lấy mã TPOS cho các đơn hàng trong khoảng thời gian đã chọn và mở cửa sổ upload.
              </p>
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant={"outline"}
                      className={cn(
                        "w-[280px] justify-start text-left font-normal",
                        !tposSyncDateRange && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tposSyncDateRange?.from ? (
                        tposSyncDateRange.to ? (
                          <>
                            {format(tposSyncDateRange.from, "dd/MM/yyyy")} -{" "}
                            {format(tposSyncDateRange.to, "dd/MM/yyyy")}
                          </>
                        ) : (
                          format(tposSyncDateRange.from, "dd/MM/yyyy")
                        )
                      ) : (
                        <span>Chọn ngày</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={tposSyncDateRange?.from}
                      selected={tposSyncDateRange}
                      onSelect={setTposSyncDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
                <Button
                  onClick={handleSyncAndUpload}
                  disabled={isSyncingTpos}
                >
                  {isSyncingTpos ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Đang đồng bộ...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Đồng bộ & Upload
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Section 2: Đồng bộ mã biến thể (Product ID) */}
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
