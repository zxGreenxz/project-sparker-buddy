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
      // Query ALL products without limit to check entire inventory
      console.log('🔄 Bắt đầu query toàn bộ products...');
      const { data: allProducts, error: queryError } = await supabase
        .from('products')
        .select('id, product_code, product_name, tpos_image_url, product_images')
        .order('product_code');

      if (queryError) {
        console.error('❌ Lỗi query products:', queryError);
        throw queryError;
      }

      // Filter to get variants without images
      console.log('📦 Tổng số products:', allProducts?.length);
      
      const variantsToSync = (allProducts || []).filter(product => {
        const code = product.product_code;
        const isVariant = isVariantCode(code);
        const baseCode = extractBaseCode(code);
        
        // Debug: Log detection results for all potential variants
        if (isVariant) {
          console.log(`🔍 Phát hiện variant: ${code} → base: ${baseCode}`, {
            tpos_image_url: product.tpos_image_url?.substring(0, 30),
            product_images: product.product_images?.length || 0
          });
        }
        
        // Check if it's a variant code
        if (!isVariant) {
          return false;
        }

        // Check image fields - treat empty strings as no image
        const tposImageEmpty = !product.tpos_image_url || product.tpos_image_url.trim() === '';
        const productImagesEmpty = !product.product_images || product.product_images.length === 0;
        
        const hasNoImage = tposImageEmpty && productImagesEmpty;
        
        if (hasNoImage) {
          console.log(`✅ Variant cần đồng bộ: ${code} → tìm ảnh từ ${baseCode}`);
        }
        
        return hasNoImage;
      });

      syncResult.total = variantsToSync.length;

      console.log(`📊 Tổng cộng tìm thấy ${syncResult.total} biến thể cần đồng bộ`);

      if (syncResult.total === 0) {
        toast.info("Không tìm thấy biến thể nào cần đồng bộ ảnh");
        setIsSyncing(false);
        return;
      }

      console.log('🚀 Bắt đầu đồng bộ...');

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
          console.log(`🔍 [${i + 1}/${variantsToSync.length}] Tìm base product "${baseCode}" cho variant "${variant.product_code}"`);
          
          const { data: baseProduct, error: baseError } = await supabase
            .from('products')
            .select('tpos_image_url, product_images, product_code')
            .eq('product_code', baseCode)
            .maybeSingle();

          if (baseError) {
            console.error(`❌ Lỗi query base product ${baseCode}:`, baseError);
            throw baseError;
          }

          if (!baseProduct) {
            const errorMsg = `${variant.product_code}: Không tìm thấy base product "${baseCode}"`;
            console.log(`⚠️ ${errorMsg}`);
            syncResult.errors.push(errorMsg);
            syncResult.skipped++;
            continue;
          }

          // Get image URL (priority: product_images[0], fallback: tpos_image_url)
          const productImage = baseProduct.product_images?.[0];
          const tposImage = baseProduct.tpos_image_url?.trim();
          const imageUrl = productImage || tposImage;

          console.log(`   📸 Base "${baseCode}" images:`, {
            has_product_images: !!productImage,
            has_tpos_image: !!tposImage,
            will_use: imageUrl ? 'product_images[0] or tpos_image_url' : 'NONE'
          });

          if (!imageUrl) {
            const errorMsg = `${variant.product_code}: Base product "${baseCode}" không có ảnh`;
            console.log(`   ⚠️ ${errorMsg}`);
            syncResult.errors.push(errorMsg);
            syncResult.skipped++;
            continue;
          }

          console.log(`   ✅ Đồng bộ "${variant.product_code}" ← "${baseCode}"`);

          // Update variant with image URL
          const { error: updateError } = await supabase
            .from('products')
            .update({ tpos_image_url: imageUrl })
            .eq('id', variant.id);

          if (updateError) {
            console.error(`   ❌ Lỗi update ${variant.product_code}:`, updateError);
            throw updateError;
          }

          console.log(`   ✔️ Đã cập nhật thành công`);
          syncResult.synced++;
        } catch (error: any) {
          const errorMsg = `${variant.product_code}: ${error.message}`;
          console.error(`❌ Error syncing ${variant.product_code}:`, error);
          syncResult.errors.push(errorMsg);
          syncResult.skipped++;
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
