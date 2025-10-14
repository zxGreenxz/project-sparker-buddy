import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Search, Loader2, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SelectProductFromInventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phaseId: string;
  sessionId: string;
}

interface InventoryProduct {
  id: string;
  product_code: string;
  product_name: string;
  variant: string | null;
  purchase_price: number | null;
}

export function SelectProductFromInventoryDialog({
  open,
  onOpenChange,
  phaseId,
  sessionId,
}: SelectProductFromInventoryDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [preparedQuantity, setPreparedQuantity] = useState<number>(1);
  const queryClient = useQueryClient();

  // Fetch products from inventory
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["inventory-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, product_code, product_name, variant, purchase_price")
        .order("product_code", { ascending: true });

      if (error) throw error;
      return (data || []) as InventoryProduct[];
    },
    enabled: open,
  });

  // Filter products by search query
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;

    const keywords = searchQuery.trim().toLowerCase().split(/\s+/);

    return products.filter((product) => {
      const searchText = `${product.product_code} ${product.product_name} ${product.variant || ""}`.toLowerCase();
      return keywords.every((keyword) => searchText.includes(keyword));
    });
  }, [products, searchQuery]);

  // Add product to live session mutation
  const addProductMutation = useMutation({
    mutationFn: async ({ productId, quantity }: { productId: string; quantity: number }) => {
      const product = products.find((p) => p.id === productId);
      if (!product) throw new Error("Product not found");

      // Check if product already exists in this phase
      const { data: existingProduct, error: checkError } = await supabase
        .from("live_products")
        .select("id")
        .eq("product_code", product.product_code)
        .eq("live_phase_id", phaseId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingProduct) {
        throw new Error("Sản phẩm đã tồn tại trong phiên live này");
      }

      // Insert new product to live_products
      const { error: insertError } = await supabase.from("live_products").insert({
        product_code: product.product_code,
        product_name: product.product_name,
        variant: product.variant,
        prepared_quantity: quantity,
        sold_quantity: 0,
        live_session_id: sessionId,
        live_phase_id: phaseId,
        purchase_price: product.purchase_price,
      });

      if (insertError) throw insertError;

      return product;
    },
    onSuccess: (product) => {
      toast.success("Đã thêm sản phẩm", {
        description: `${product.product_code} - ${product.product_name}`,
      });
      queryClient.invalidateQueries({ queryKey: ["live-products", phaseId] });
      onOpenChange(false);
      setSearchQuery("");
      setSelectedProductId(null);
      setPreparedQuantity(1);
    },
    onError: (error: Error) => {
      toast.error("Lỗi", {
        description: error.message || "Không thể thêm sản phẩm",
      });
    },
  });

  const handleAddProduct = () => {
    if (!selectedProductId) {
      toast.error("Vui lòng chọn sản phẩm");
      return;
    }

    if (preparedQuantity <= 0) {
      toast.error("Số lượng phải lớn hơn 0");
      return;
    }

    addProductMutation.mutate({
      productId: selectedProductId,
      quantity: preparedQuantity,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Chọn sản phẩm từ kho
          </DialogTitle>
          <DialogDescription>
            Tìm và chọn sản phẩm từ kho để thêm vào phiên live
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Tìm kiếm theo mã, tên, biến thể..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Products list */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchQuery ? "Không tìm thấy sản phẩm" : "Không có sản phẩm trong kho"}
                  </div>
                ) : (
                  filteredProducts.map((product) => (
                    <Card
                      key={product.id}
                      className={cn(
                        "cursor-pointer transition-all hover:shadow-md",
                        selectedProductId === product.id && "ring-2 ring-primary"
                      )}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          {/* Product image */}
                          <div className="w-16 h-16 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>

                          {/* Product info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-semibold text-sm truncate">
                                  {product.product_code}
                                </div>
                                <div className="text-sm mt-1">{product.product_name}</div>
                                {product.variant && (
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {product.variant}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Quantity input */}
          {selectedProductId && (
            <div className="flex items-center gap-3 pt-2 border-t">
              <label className="text-sm font-medium">Số lượng chuẩn bị:</label>
              <Input
                type="number"
                min="1"
                value={preparedQuantity}
                onChange={(e) => setPreparedQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-24"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={!selectedProductId || addProductMutation.isPending}
            >
              {addProductMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Thêm vào phiên live
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
