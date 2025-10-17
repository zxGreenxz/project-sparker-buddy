import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Image, Loader2 } from "lucide-react";
import { extractBaseCode, isVariantCode } from "@/lib/variant-utils";

interface SyncVariantImagesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SyncResult {
  total: number;
  synced: number;
  skipped: number;
  errors: string[];
}

export function SyncVariantImagesDialog({ open, onOpenChange }: SyncVariantImagesDialogProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setIsSyncing(true);
    setProgress(0);
    setResult(null);

    try {
      // Find all variants without images
      const { data: variants, error: queryError } = await supabase
        .from('products')
        .select('id, product_code, tpos_image_url, product_images')
        .or('tpos_image_url.is.null,product_images.is.null');

      if (queryError) throw queryError;

      // Filter to only variant products
      const variantsToSync = variants?.filter(p => 
        isVariantCode(p.product_code) && 
        !p.tpos_image_url && 
        (!p.product_images || p.product_images.length === 0)
      ) || [];

      const syncResult: SyncResult = {
        total: variantsToSync.length,
        synced: 0,
        skipped: 0,
        errors: []
      };

      if (variantsToSync.length === 0) {
        toast({
          title: "Không có biến thể nào cần đồng bộ",
          description: "Tất cả biến thể đều đã có ảnh",
        });
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

        // Find base product
        const { data: baseProduct, error: baseError } = await supabase
          .from('products')
          .select('tpos_image_url, product_images')
          .eq('product_code', baseCode)
          .maybeSingle();

        if (baseError || !baseProduct) {
          syncResult.skipped++;
          syncResult.errors.push(`${variant.product_code}: Không tìm thấy SP gốc ${baseCode}`);
          continue;
        }

        const imageUrl = baseProduct.product_images?.[0] || baseProduct.tpos_image_url;

        if (!imageUrl) {
          syncResult.skipped++;
          syncResult.errors.push(`${variant.product_code}: SP gốc ${baseCode} không có ảnh`);
          continue;
        }

        // Update variant with base product image
        const { error: updateError } = await supabase
          .from('products')
          .update({ tpos_image_url: imageUrl })
          .eq('id', variant.id);

        if (updateError) {
          syncResult.errors.push(`${variant.product_code}: Lỗi cập nhật - ${updateError.message}`);
        } else {
          syncResult.synced++;
        }

        setProgress(((i + 1) / variantsToSync.length) * 100);
      }

      setResult(syncResult);

      toast({
        title: "Đồng bộ hoàn tất",
        description: `Đã đồng bộ ${syncResult.synced}/${syncResult.total} biến thể`,
      });
    } catch (error) {
      console.error("Error syncing variant images:", error);
      toast({
        title: "Lỗi đồng bộ",
        description: error instanceof Error ? error.message : "Có lỗi xảy ra",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image className="h-5 w-5" />
            Đồng bộ ảnh biến thể
          </DialogTitle>
          <DialogDescription>
            Tự động lấy ảnh từ sản phẩm gốc cho các biến thể không có ảnh
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!result && !isSyncing && (
            <div className="text-sm text-muted-foreground">
              Hệ thống sẽ tìm tất cả các biến thể (ví dụ: LQU114L, N152M) không có ảnh 
              và tự động lấy ảnh từ sản phẩm gốc (LQU114, N152).
            </div>
          )}

          {isSyncing && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Đang xử lý...</div>
              <Progress value={progress} />
              <div className="text-xs text-muted-foreground text-right">
                {Math.round(progress)}%
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-3 rounded-lg border p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>Tổng số biến thể:</div>
                <div className="font-medium text-right">{result.total}</div>
                
                <div className="text-green-600">Đã đồng bộ:</div>
                <div className="font-medium text-right text-green-600">{result.synced}</div>
                
                <div className="text-yellow-600">Bỏ qua:</div>
                <div className="font-medium text-right text-yellow-600">{result.skipped}</div>
              </div>

              {result.errors.length > 0 && (
                <div className="mt-3 space-y-1">
                  <div className="text-sm font-medium text-destructive">
                    Lỗi ({result.errors.length}):
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {result.errors.map((error, i) => (
                      <div key={i} className="text-xs text-muted-foreground">
                        {error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            {result ? "Đóng" : "Hủy"}
          </Button>
          {!result && (
            <Button
              onClick={handleSync}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                "Bắt đầu đồng bộ"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
