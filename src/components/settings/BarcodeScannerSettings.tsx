import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Barcode, Package, TestTube2, XCircle } from "lucide-react";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";

export function BarcodeScannerSettings() {
  const { enabledPage, setEnabledPage } = useBarcodeScanner();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Barcode className="h-5 w-5" />
          Cài Đặt Quét Barcode
        </CardTitle>
        <CardDescription>
          Chọn trang nào sẽ kích hoạt tính năng quét barcode tự động
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup value={enabledPage} onValueChange={(value) => setEnabledPage(value as any)}>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="live-products" id="live-products" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="live-products" className="flex items-center gap-2 cursor-pointer">
                  <Package className="h-4 w-4" />
                  <span className="font-medium">Sản Phẩm Live</span>
                  {enabledPage === 'live-products' && (
                    <Badge variant="default" className="ml-auto">Đang bật</Badge>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Quét barcode để thêm sản phẩm vào phiên live đang chọn
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="settings-test" id="settings-test" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="settings-test" className="flex items-center gap-2 cursor-pointer">
                  <TestTube2 className="h-4 w-4" />
                  <span className="font-medium">Settings - Test Barcode</span>
                  {enabledPage === 'settings-test' && (
                    <Badge variant="default" className="ml-auto">Đang bật</Badge>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Chỉ để test chức năng quét barcode trong Settings
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
              <RadioGroupItem value="disabled" id="disabled" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="disabled" className="flex items-center gap-2 cursor-pointer">
                  <XCircle className="h-4 w-4" />
                  <span className="font-medium">Tắt</span>
                  {enabledPage === 'disabled' && (
                    <Badge variant="secondary" className="ml-auto">Đang tắt</Badge>
                  )}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">
                  Không kích hoạt quét barcode tự động ở bất kỳ trang nào
                </p>
              </div>
            </div>
          </div>
        </RadioGroup>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>💡 Lưu ý:</strong> Khi quét barcode ở trang khác, hệ thống sẽ hỏi bạn có muốn chuyển sang trang đã chọn không.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
