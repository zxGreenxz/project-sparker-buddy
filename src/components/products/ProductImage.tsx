import { useState, useEffect, useRef } from "react";
import { ImageIcon, Loader2 } from "lucide-react";
import { fetchAndSaveTPOSImage, getProductImageUrl } from "@/lib/tpos-image-loader";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";

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
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPosition, setZoomPosition] = useState({ top: 0, left: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

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

  const handleMouseEnter = () => {
    if (!imgRef.current || !imageUrl) return;
    
    const rect = imgRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const zoomedHeight = 600;
    
    let top = rect.top;
    
    if (rect.top + zoomedHeight > viewportHeight) {
      top = rect.bottom - zoomedHeight;
    }
    
    if (top < 0) {
      top = rect.top;
    }
    
    setZoomPosition({
      top: top,
      left: rect.right + 10
    });
    
    setIsZoomed(true);
  };

  const handleMouseLeave = () => {
    setIsZoomed(false);
  };

  const handleImageClick = async () => {
    if (!imageUrl) return;
    
    try {
      // Fetch image as blob to bypass CORS
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Failed to fetch image");
      
      const blob = await response.blob();
      
      // Create image from blob URL
      const img = new Image();
      const objectUrl = URL.createObjectURL(blob);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = objectUrl;
      });
      
      // Draw to canvas and convert to PNG
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        throw new Error("Could not get canvas context");
      }
      
      ctx.drawImage(img, 0, 0);
      
      // Clean up object URL
      URL.revokeObjectURL(objectUrl);
      
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create blob"));
        }, "image/png");
      });
      
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": pngBlob })
      ]);
      
      toast.success("Đã copy ảnh vào clipboard!");
    } catch (error) {
      console.error("Error copying image:", error);
      toast.error("Không thể copy ảnh. Vui lòng thử lại.");
    }
  };

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
        ref={imgRef}
        src={imageUrl}
        alt={productCode}
        className="w-10 h-10 object-cover rounded cursor-pointer transition-opacity duration-200 hover:opacity-80"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleImageClick}
        onError={(e) => {
          e.currentTarget.style.display = 'none';
          e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
        }}
      />
      <div className="w-10 h-10 hidden fallback-icon flex items-center justify-center bg-muted rounded">
        <ImageIcon className="h-4 w-4 text-muted-foreground" />
      </div>

      {isZoomed && (
        <div
          className="fixed pointer-events-none z-[9999]"
          style={{
            top: `${zoomPosition.top}px`,
            left: `${zoomPosition.left}px`,
            maxWidth: '600px',
            maxHeight: '600px'
          }}
        >
          <img
            src={imageUrl}
            alt={productCode}
            className="w-auto h-auto max-w-[600px] max-h-[600px] object-contain rounded-lg shadow-2xl border-4 border-background"
          />
        </div>
      )}
    </>
  );
}
