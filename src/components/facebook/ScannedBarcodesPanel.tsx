import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Barcode, Trash2, X, Package, Check } from "lucide-react";
import { useBarcodeScanner } from "@/contexts/BarcodeScannerContext";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

export function ScannedBarcodesPanel() {
  const { scannedBarcodes, clearScannedBarcodes, removeScannedBarcode } = useBarcodeScanner();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(true);
  const [manualCode, setManualCode] = useState("");

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (code) {
      // Dispatch event giống như quét barcode thật
      window.dispatchEvent(
        new CustomEvent('barcode-scanned', { 
          detail: { code } 
        })
      );
      setManualCode(""); // Clear input
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSubmit();
    }
  };

  return (
    <Card className={isMobile ? "mx-4" : ""}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Barcode className="h-4 w-4" />
          Nhập mã sản phẩm
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Manual Input Section */}
        <div className="flex gap-2">
          <Input
            placeholder="Nhập mã sản phẩm..."
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button 
            onClick={handleManualSubmit}
            disabled={!manualCode.trim()}
            size="sm"
          >
            <Check className="h-4 w-4 mr-1" />
            Xác nhận
          </Button>
        </div>

        {/* Show scanned barcodes if any */}
        {scannedBarcodes.length > 0 ? (
          <>
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm font-medium">
                Barcode đã quét ({scannedBarcodes.length})
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-7 px-2"
                >
                  {isExpanded ? "Thu gọn" : "Mở rộng"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearScannedBarcodes}
                  className="h-7 px-2"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <ScrollArea className="h-[300px]">
                <div className="space-y-2">
                  {scannedBarcodes.map((barcode, index) => (
                    <div
                      key={`${barcode.code}-${index}`}
                      className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                    >
                      {barcode.productInfo?.image_url ? (
                        <img
                          src={barcode.productInfo.image_url}
                          alt={barcode.productInfo.name}
                          className="w-12 h-12 rounded object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm font-medium truncate">
                              {barcode.code}
                            </p>
                            {barcode.productInfo ? (
                              <p className="text-xs text-muted-foreground truncate">
                                {barcode.productInfo.name}
                              </p>
                            ) : (
                              <Badge variant="secondary" className="text-xs mt-1">
                                Không tìm thấy sản phẩm
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeScannedBarcode(barcode.code)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(barcode.timestamp), 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Barcode className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              Chưa có barcode nào được quét
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Quét barcode hoặc nhập mã thủ công bên trên
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
