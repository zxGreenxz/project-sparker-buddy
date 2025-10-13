import { useState, useEffect } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { fetchAndSaveTPOSImage, getProductImageUrl } from "@/lib/tpos-image-loader";
import { Dialog, DialogContent } from "@/components/ui/dialog";

interface ProductImageProps {
  productId: string;
  productCode: string;
  productImages?: string[] | null;
  tposImageUrl?: string | null;
  tposProductId?: number | null;
}

export function ProductImage({
  productId,
  productCode,
  productImages,
  tposImageUrl,
  tposProductId,
}: ProductImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // Get initial image URL based on priority
    const initialUrl = getProductImageUrl(productImages || null, tposImageUrl || null);
    
    if (initialUrl) {
      setImageUrl(initialUrl);
    } else if (tposProductId && !isLoading) {
      // No image available, fetch from TPOS (one-time only)
      setIsLoading(true);
      fetchAndSaveTPOSImage(productId, productCode, tposProductId)
        .then((url) => {
          if (url) {
            setImageUrl(url);
          }
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [productId, productCode, productImages, tposImageUrl, tposProductId]);

  if (isLoading) {
    return (
      <div className="w-10 h-10 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="w-10 h-10 flex items-center justify-center bg-muted rounded">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <img
        src={imageUrl}
        alt={productCode}
        className="w-10 h-10 object-cover rounded img-zoom-right-lg"
        onClick={() => setIsDialogOpen(true)}
        onError={(e) => {
          // If image fails to load, show placeholder
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
        }}
      />
      <div className="w-10 h-10 hidden fallback-icon flex items-center justify-center bg-muted rounded">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl">
          <img
            src={imageUrl}
            alt={productCode}
            className="w-full h-auto"
          />
          <div className="text-sm text-muted-foreground text-center mt-2">
            {productCode}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
