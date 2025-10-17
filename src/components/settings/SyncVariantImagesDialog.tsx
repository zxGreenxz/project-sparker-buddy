import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { extractBaseCode, isVariantCode } from "@/lib/variant-utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, AlertCircle, Image } from "lucide-react";
import { toast } from "sonner";

interface SyncVariantImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  errors: string[];
}

export function SyncVariantImagesDialog(props: SyncVariantImagesDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setProgress(0);
    setResult(null);

    const syncResult: SyncResult = {
      total: 0,
      synced: 0,
      skipped: 0,
      errors: [],
    };

    try {
      // Query all products to filter variants
      const { data: allProducts, error: queryError } = await supabase
        .from('products')
        .select('id, product_code, product_name, tpos_image_url, product_images')
        .order('product_code');

      if (queryError) throw queryError;

      // Filter to get variants without images
      const variantsToSync = (allProducts || []).filter(product => {
        const code = product.product_code;
        
        // Debug: Log all products starting with LQU114 to check detection
        if (code.startsWith('LQU114')) {
          console.log(`🔍 Kiểm tra ${code}:`, {
            isVariant: isVariantCode(code),
            baseCode: extractBaseCode(code),
            tpos_image_url: product.tpos_image_url,
            product_images: product.product_images
          });
        }
        
        // Check if it's a variant code
        if (!isVariantCode(code)) {
          return false;
        }

        // Check image fields - treat empty strings as no image
        const tposImageEmpty = !product.tpos_image_url || product.tpos_image_url.trim() === '';
        const productImagesEmpty = !product.product_images || product.product_images.length === 0;
        
        const hasNoImage = tposImageEmpty && productImagesEmpty;
        
        if (hasNoImage) {
          console.log(`✨ Variant cần đồng bộ: ${code}`);
        }
        
        return hasNoImage;
      });

      syncResult.total = variantsToSync.length;

      if (syncResult.total === 0) {
        toast.info("Không tìm thấy biến thể nào cần đồng bộ ảnh");
        setIsSyncing(false);
        return;
      }

      // Process each variant
      for (let i = 0; i < variantsToSync.length; i++) {
        const variant = variantsToSync[i];
        const baseCode = extractBaseCode(variant.product_code);

        if (!baseCode) {
          syncResult.skipped++;
          continue;
        }

        try {
          // Find base product
          const { data: baseProduct, error: baseError } = await supabase
            .from('products')
            .select('tpos_image_url, product_images, product_code')
            .eq('product_code', baseCode)
            .maybeSingle();

          if (baseError) throw baseError;

          if (!baseProduct) {
            console.log(`❌ Không tìm thấy base product: ${baseCode} cho variant: ${variant.product_code}`);
            syncResult.skipped++;
            continue;
          }

          // Get image URL (priority: product_images[0], fallback: tpos_image_url)
          // Check both empty string and null
          const productImage = baseProduct.product_images?.[0];
          const tposImage = baseProduct.tpos_image_url?.trim();
          const imageUrl = productImage || tposImage;

          console.log(`📸 Base product ${baseCode}:`, {
            productImage: productImage?.substring(0, 50),
            tposImage: tposImage?.substring(0, 50),
            finalImageUrl: imageUrl?.substring(0, 50)
          });

          if (!imageUrl) {
            console.log(`❌ Base product ${baseCode} không có ảnh`);
            syncResult.skipped++;
            continue;
          }

          console.log(`✅ Đồng bộ ${variant.product_code} ← ${baseCode}: ${imageUrl.substring(0, 50)}...`);

          // Update variant with image URL
          const { error: updateError } = await supabase
            .from('products')
            .update({ tpos_image_url: imageUrl })
            .eq('id', variant.id);

          if (updateError) throw updateError;

          syncResult.synced++;
        } catch (error: any) {
          console.error(`Error syncing ${variant.product_code}:`, error);
          syncResult.errors.push(`${variant.product_code}: ${error.message}`);
        }

        // Update progress
        setProgress(Math.round(((i + 1) / variantsToSync.length) * 100));
      }

      setResult(syncResult);

      if (syncResult.synced > 0) {
        toast.success(`Đã đồng bộ ảnh cho ${syncResult.synced} biến thể`);
        props.onSuccess?.();
      }
    } catch (error: any) {
      console.error("Error syncing variant images:", error);
      toast.error("Có lỗi khi đồng bộ ảnh biến thể");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClose = () => {
    if (!isSyncing) {
      props.onOpenChange(false);
      setTimeout(() => {
        setResult(null);
        setProgress(0);
      }, 300);
    }
  };

  return (
    <Dialog open={props.open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Đồng bộ ảnh biến thể
          </DialogTitle>
          <DialogDescription>
            Tự động lấy ảnh từ sản phẩm gốc cho các biến thể chưa có ảnh
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!result && !isSyncing && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Công cụ này sẽ tìm các biến thể (ví dụ: LQU114L, N152M) không có ảnh,
                sau đó lấy ảnh từ sản phẩm gốc (LQU114, N152) để đồng bộ.
              </AlertDescription>
            </Alert>
          )}

          {isSyncing && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Đang xử lý...</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {result && (
            <div className="space-y-3">
              <Alert className="border-green-200 bg-green-50">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  <div className="space-y-1">
                    <div className="font-medium">Kết quả đồng bộ:</div>
                    <div className="text-sm space-y-0.5">
                      <div>• Tổng số biến thể tìm thấy: {result.total}</div>
                      <div className="text-green-700">• Đã đồng bộ: {result.synced}</div>
                      <div className="text-yellow-700">• Bỏ qua: {result.skipped}</div>
                      {result.errors.length > 0 && (
                        <div className="text-red-700">• Lỗi: {result.errors.length}</div>
                      )}
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {result.errors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="space-y-1">
                      <div className="font-medium">Danh sách lỗi:</div>
                      <div className="text-xs space-y-0.5 max-h-32 overflow-y-auto">
                        {result.errors.map((error, idx) => (
                          <div key={idx}>• {error}</div>
                        ))}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            {!result ? (
              <>
                <Button
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSyncing}
                >
                  Hủy
                </Button>
                <Button
                  onClick={handleSync}
                  disabled={isSyncing}
                >
                  {isSyncing ? "Đang đồng bộ..." : "Bắt đầu đồng bộ"}
                </Button>
              </>
            ) : (
              <Button onClick={handleClose}>
                Đóng
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
