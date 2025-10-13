import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuickAddOrder } from "./QuickAddOrder";
import { X, Package } from "lucide-react";

interface LiveProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant?: string;
  prepared_quantity: number;
  sold_quantity: number;
}

interface LiveOrder {
  id: string;
  order_code: string;
  tpos_order_id?: string | null;
  live_product_id: string;
  quantity: number;
  is_oversell?: boolean;
}

interface FullScreenProductViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: LiveProduct[];
  orders: LiveOrder[];
  selectedPhase: string | null;
  selectedSession: string | null;
}

export function FullScreenProductView({
  open,
  onOpenChange,
  products,
  orders,
  selectedPhase,
  selectedSession,
}: FullScreenProductViewProps) {
  const midPoint = Math.ceil(products.length / 2);
  const leftProducts = products.slice(0, midPoint);
  const rightProducts = products.slice(midPoint);

  const getProductOrders = (productId: string) => {
    return orders.filter(order => order.live_product_id === productId);
  };

  const renderProductCard = (product: LiveProduct) => {
    const productOrders = getProductOrders(product.id);
    const remaining = product.prepared_quantity - product.sold_quantity;
    const isOutOfStock = remaining <= 0;

    return (
      <div
        key={product.id}
        className="border rounded-lg p-4 space-y-3 bg-card"
      >
        {/* Product Info */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm truncate">{product.product_code}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{product.product_name}</p>
              {product.variant && (
                <p className="text-xs text-muted-foreground mt-1">Biến thể: {product.variant}</p>
              )}
            </div>
            {isOutOfStock && (
              <Badge variant="destructive" className="shrink-0">Hết</Badge>
            )}
          </div>

          {/* Quantity Info */}
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Package className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Chuẩn bị:</span>
              <span className="font-medium">{product.prepared_quantity}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Đã bán:</span>
              <span className="font-medium">{product.sold_quantity}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">Còn:</span>
              <span className={`font-medium ${isOutOfStock ? 'text-destructive' : 'text-primary'}`}>
                {remaining}
              </span>
            </div>
          </div>
        </div>

        {/* Existing Orders */}
        {productOrders.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {productOrders.map((order) => (
              <Badge
                key={order.id}
                variant={order.is_oversell ? "destructive" : "secondary"}
                className="text-xs"
              >
                {order.order_code} ({order.quantity})
              </Badge>
            ))}
          </div>
        )}

        {/* Quick Add Order */}
        <div className="pt-2 border-t">
          <QuickAddOrder
            productId={product.id}
            phaseId={selectedPhase || ""}
            sessionId={selectedSession || ""}
            availableQuantity={remaining}
          />
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] w-full h-[95vh] p-0 gap-0">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">Danh sách sản phẩm - Chế độ toàn màn hình</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Tổng số: {products.length} sản phẩm - Hiển thị 2 cột
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-hidden p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            {/* Left Column */}
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {leftProducts.length > 0 ? (
                  leftProducts.map(renderProductCard)
                ) : (
                  <p className="text-center text-muted-foreground py-8">Không có sản phẩm</p>
                )}
              </div>
            </ScrollArea>

            {/* Right Column */}
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {rightProducts.length > 0 ? (
                  rightProducts.map(renderProductCard)
                ) : (
                  <p className="text-center text-muted-foreground py-8">Không có sản phẩm</p>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
