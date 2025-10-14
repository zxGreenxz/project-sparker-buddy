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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { formatVND } from "@/lib/currency-utils";
import { ProductImage } from "@/components/products/ProductImage";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebounce } from "@/hooks/use-debounce";
import { applyMultiKeywordSearch } from "@/lib/search-utils";

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
  variant?: string;
  selling_price: number;
  purchase_price: number;
  stock_quantity: number;
  product_images?: string[];
  tpos_image_url?: string;
  tpos_product_id?: number;
}

export function SelectProductFromInventoryDialog({
  open,
  onOpenChange,
  phaseId,
  sessionId,
}: SelectProductFromInventoryDialogProps) {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [preparedQuantity, setPreparedQuantity] = useState<number>(1);
  const queryClient = useQueryClient();
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch products from inventory
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["inventory-products-select", debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      
      // Nếu có search (>= 2 ký tự): Search trong database
      if (debouncedSearch.length >= 2) {
        query = applyMultiKeywordSearch(
          query,
          debouncedSearch,
          ['product_name', 'product_code', 'barcode', 'variant']
        );
      } else {
        // Load 50 SP mới nhất (không search)
        query = query.range(0, 49);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryProduct[];
    },
    enabled: open,
    staleTime: 30000,
    gcTime: 60000,
  });

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

  if (isMobile) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
            <DialogDescription>
              Tìm và chọn sản phẩm từ kho để thêm vào phiên live
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, variant (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="text-sm text-muted-foreground">
              {debouncedSearch.length >= 2 
                ? `Tìm thấy ${products.length} sản phẩm`
                : `Hiển thị ${products.length} sản phẩm mới nhất`
              }
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <Skeleton className="h-4 w-3/4 mb-2" />
                    <Skeleton className="h-3 w-1/2 mb-2" />
                    <Skeleton className="h-3 w-full" />
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {products.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                  </div>
                ) : (
                  products.map((product) => (
                    <Card
                      key={product.id}
                      className={`p-4 cursor-pointer transition-colors ${
                        selectedProductId === product.id ? "ring-2 ring-primary" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <div className="space-y-2">
                        <div className="font-semibold">{product.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {product.product_code}
                          {product.variant && ` - ${product.variant}`}
                        </div>
                        <div className="text-sm">
                          <div>
                            <span className="text-muted-foreground">Giá bán: </span>
                            <span className="font-medium">{formatVND(product.selling_price)}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Tồn kho: </span>
                            <span className="font-medium">{product.stock_quantity}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            )}
            
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

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Hủy
              </Button>
              <Button
                onClick={handleAddProduct}
                disabled={!selectedProductId || addProductMutation.isPending}
              >
                Thêm vào phiên live
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn sản phẩm từ kho</DialogTitle>
          <DialogDescription>
            Tìm và chọn sản phẩm từ kho để thêm vào phiên live
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          <div className="space-y-2">
            <Input
              placeholder="Tìm kiếm theo mã SP, tên, variant (tối thiểu 2 ký tự)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            
            <div className="text-sm text-muted-foreground">
              {debouncedSearch.length >= 2 
                ? `Tìm thấy ${products.length} sản phẩm`
                : `Hiển thị ${products.length} sản phẩm mới nhất`
              }
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden flex-1 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Hình ảnh</TableHead>
                  <TableHead>Mã SP</TableHead>
                  <TableHead>Tên sản phẩm</TableHead>
                  <TableHead>Variant</TableHead>
                  <TableHead>Giá bán</TableHead>
                  <TableHead>Tồn kho</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-12 w-12" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {debouncedSearch.length >= 2 ? "Không tìm thấy sản phẩm phù hợp" : "Chưa có sản phẩm nào"}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product) => (
                    <TableRow 
                      key={product.id} 
                      className={`cursor-pointer ${
                        selectedProductId === product.id ? "bg-muted" : "hover:bg-muted/50"
                      }`}
                      onClick={() => setSelectedProductId(product.id)}
                    >
                      <TableCell>
                        <ProductImage
                          productId={product.id}
                          productCode={product.product_code}
                          productImages={product.product_images}
                          tposImageUrl={product.tpos_image_url}
                          tposProductId={product.tpos_product_id}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{product.product_code}</TableCell>
                      <TableCell>{product.product_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {product.variant || "-"}
                      </TableCell>
                      <TableCell>{formatVND(product.selling_price)}</TableCell>
                      <TableCell>{product.stock_quantity}</TableCell>
                      <TableCell>
                        {selectedProductId === product.id && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

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

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button
              onClick={handleAddProduct}
              disabled={!selectedProductId || addProductMutation.isPending}
            >
              Thêm vào phiên live
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
